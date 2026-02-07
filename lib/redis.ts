import { Redis } from '@upstash/redis';
import { RedisKeyData, ModelConfig, APIProfile } from './types';

// Initialize Redis client
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Fetch and parse key data from Redis with auto-migration
 * @param key - The API key to look up
 * @returns RedisKeyData or null if key doesn't exist
 */
export async function getKeyData(key: string): Promise<RedisKeyData | null> {
    try {
        const data = await redis.get<any>(key);
        if (!data) return null;

        const today = new Date().toISOString().split('T')[0];

        // 1. Check if it's already the simplified daily limit schema
        if ('daily_limit' in data && 'usage_today' in data) {
            // Check if we need to reset today's usage
            if (data.usage_today.date !== today) {
                data.usage_today = { date: today, count: 0 };
                await redis.set(key, data);
            }
            return data as RedisKeyData;
        }

        // 2. Migrate from ANY previous schema to Daily Limit schema
        console.log(`[REDIS] Migrating key ${key} to simplified daily limit schema`);

        let dailyLimit = 100; // Default limit for migrated keys

        // Try to infer a reasonable daily limit from old max values
        if ('max_concurrent_users' in data) {
            dailyLimit = data.max_concurrent_users * 50; // Assume 50 chats per device
        } else if ('max_activations' in data) {
            dailyLimit = data.max_activations * 50;
        } else if ('max_ips' in data) {
            dailyLimit = data.max_ips * 50;
        }

        const newData: RedisKeyData = {
            expiry: data.expiry,
            daily_limit: dailyLimit,
            usage_today: {
                date: today,
                count: 0
            },
            session_timeout_minutes: 15
        };

        await redis.set(key, newData);
        console.log(`[REDIS] Migration complete for ${key}. New daily limit: ${dailyLimit}`);
        return newData;
    } catch (error) {
        console.error('Error fetching key from Redis:', error);
        return null;
    }
}

// =====================
// LEGACY FUNCTIONS (Deprecated - kept for backward compatibility)
// These functions are no longer used in the concurrent usage model
// =====================

/**
 * @deprecated Use concurrent session model instead
 * Activate a key for a new device
 */
export async function activateDevice(key: string, deviceId: string): Promise<boolean> {
    console.warn('[REDIS] activateDevice is deprecated - use concurrent session model');
    return false;
}

/**
 * @deprecated Use concurrent session model instead
 * Check if a device is already activated for a key
 */
export async function isDeviceActivated(key: string, deviceId: string): Promise<boolean> {
    console.warn('[REDIS] isDeviceActivated is deprecated - use concurrent session model');
    return false;
}

/**
 * Create a new API key in Redis with daily limit
 * @param keyName - The name/ID of the key
 * @param expiry - Expiry date in YYYY-MM-DD format
 * @param dailyLimit - Maximum requests per day
 * @returns Object with success status
 */
export async function createKey(
    keyName: string,
    expiry: string,
    dailyLimit: number = 100
): Promise<{ success: boolean }> {
    try {
        const today = new Date().toISOString().split('T')[0];
        const newKey: RedisKeyData = {
            expiry,
            daily_limit: dailyLimit,
            usage_today: {
                date: today,
                count: 0
            },
            session_timeout_minutes: 15
        };
        await redis.set(keyName, newKey);
        return { success: true };
    } catch (error) {
        console.error('Error creating key in Redis:', error);
        return { success: false };
    }
}

/**
 * Increment usage for a key and check daily limit
 * @param keyName - The API key name
 * @returns Object with allowed status and current usage info
 */
export async function incrementUsage(keyName: string): Promise<{
    allowed: boolean;
    currentUsage: number;
    limit: number;
    reason?: string;
}> {
    try {
        const data = await getKeyData(keyName);
        if (!data) return { allowed: false, currentUsage: 0, limit: 0, reason: 'invalid_key' };

        if (data.usage_today.count >= data.daily_limit) {
            return {
                allowed: false,
                currentUsage: data.usage_today.count,
                limit: data.daily_limit,
                reason: 'daily_limit_reached'
            };
        }

        // Increment and save
        data.usage_today.count += 1;
        await redis.set(keyName, data);

        return {
            allowed: true,
            currentUsage: data.usage_today.count,
            limit: data.daily_limit
        };
    } catch (error) {
        console.error('Error incrementing usage:', error);
        return { allowed: false, currentUsage: 0, limit: 0, reason: 'server_error' };
    }
}

/**
 * Delete a key from Redis
 * @param keyName - The name of the key to delete
 * @returns true if successful, false otherwise
 */
export async function deleteKey(keyName: string): Promise<boolean> {
    try {
        const result = await redis.del(keyName);
        return result === 1;
    } catch (error) {
        console.error('Error deleting key from Redis:', error);
        return false;
    }
}

/**
 * Get all keys from Redis
 * @returns Array of key names
 */
export async function getAllKeys(): Promise<string[]> {
    try {
        const keys = await redis.keys('*');
        return keys || [];
    } catch (error) {
        console.error('Error fetching all keys from Redis:', error);
        return [];
    }
}

/**
 * Check if a key has expired
 * @param expiryDate - The expiry date string in YYYY-MM-DD format
 * @returns true if expired, false otherwise
 */
export function isExpired(expiryDate: string): boolean {
    const expiry = new Date(expiryDate);
    const now = new Date();

    // Set time to midnight for date-only comparison
    expiry.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    return now > expiry;
}

// =====================
// SETTINGS MANAGEMENT
// =====================

export interface ProxySettings {
    api_url: string;
    api_key: string;
    model_display: string;  // Model name shown to clients (e.g., "Claude-Opus-4.5-VIP")
    model_actual: string;   // Actual model to use (e.g., "claude-3-5-haiku-20241022")
    system_prompt?: string; // Optional system prompt to prepend to all requests
    models?: Record<string, ModelConfig>; // Per-model system prompts (e.g., {"gemini": {...}, "gpt5": {...}})
}

const SETTINGS_KEY = '__proxy_settings__';

/**
 * Get proxy settings from Redis
 * @returns ProxySettings or null if not configured
 */
export async function getSettings(): Promise<ProxySettings | null> {
    try {
        const settings = await redis.get<ProxySettings>(SETTINGS_KEY);
        return settings || null;
    } catch (error) {
        console.error('Error fetching settings from Redis:', error);
        return null;
    }
}

/**
 * Save proxy settings to Redis
 */
export async function saveSettings(
    apiUrl: string,
    apiKey: string,
    modelDisplay?: string,
    modelActual?: string,
    systemPrompt?: string
): Promise<boolean> {
    try {
        // Get existing settings first to preserve values if not provided
        const existing = await getSettings();

        const settings: ProxySettings = {
            api_url: apiUrl,
            api_key: apiKey,
            model_display: modelDisplay || existing?.model_display || 'Claude-Opus-4.5-VIP',
            model_actual: modelActual || existing?.model_actual || 'claude-3-5-haiku-20241022',
            system_prompt: systemPrompt !== undefined ? systemPrompt : (existing?.system_prompt || ''),
            models: existing?.models || {}
        };
        await redis.set(SETTINGS_KEY, settings);
        return true;
    } catch (error) {
        console.error('Error saving settings to Redis:', error);
        return false;
    }
}

// =====================
// MODEL MANAGEMENT
// =====================

/**
 * Get the selected model for a specific API key
 * @param keyName - The API key name
 * @returns The selected model ID or null if not set
 */
export async function getKeySelectedModel(keyName: string): Promise<string | null> {
    try {
        const data = await getKeyData(keyName);
        return data?.selected_model || null;
    } catch (error) {
        console.error('Error getting key selected model:', error);
        return null;
    }
}

/**
 * Set the selected model for a specific API key
 * @param keyName - The API key name
 * @param modelId - The model ID to set (e.g., "gemini", "gpt5") or null to clear
 * @returns true if successful
 */
export async function setKeySelectedModel(keyName: string, modelId: string | null): Promise<boolean> {
    try {
        const data = await getKeyData(keyName);
        if (!data) return false;

        if (modelId === null) {
            delete data.selected_model;
        } else {
            data.selected_model = modelId;
        }

        await redis.set(keyName, data);
        return true;
    } catch (error) {
        console.error('Error setting key selected model:', error);
        return false;
    }
}

/**
 * Get all model configurations from settings
 * @returns Record of model configs or empty object
 */
export async function getModelConfigs(): Promise<Record<string, ModelConfig>> {
    try {
        const settings = await getSettings();
        return settings?.models || {};
    } catch (error) {
        console.error('Error getting model configs:', error);
        return {};
    }
}

/**
 * Save or update a model configuration
 * @param modelId - The model ID (e.g., "gemini")
 * @param config - The model configuration
 * @returns true if successful
 */
export async function saveModelConfig(modelId: string, config: ModelConfig): Promise<boolean> {
    try {
        const settings = await getSettings();
        if (!settings) {
            console.error('Settings not configured');
            return false;
        }

        const models = settings.models || {};
        models[modelId] = config;
        settings.models = models;

        await redis.set(SETTINGS_KEY, settings);
        return true;
    } catch (error) {
        console.error('Error saving model config:', error);
        return false;
    }
}

/**
 * Delete a model configuration
 * @param modelId - The model ID to delete
 * @returns true if successful
 */
export async function deleteModelConfig(modelId: string): Promise<boolean> {
    try {
        const settings = await getSettings();
        if (!settings || !settings.models) return false;

        delete settings.models[modelId];
        await redis.set(SETTINGS_KEY, settings);
        return true;
    } catch (error) {
        console.error('Error deleting model config:', error);
        return false;
    }
}

// =====================
// API PROFILE MANAGEMENT
// =====================

const API_PROFILES_KEY = '__api_profiles__';

/**
 * Get all API profiles
 * @returns Record of profiles or empty object
 */
export async function getAPIProfiles(): Promise<Record<string, APIProfile>> {
    try {
        const profiles = await redis.get<Record<string, APIProfile>>(API_PROFILES_KEY);
        return profiles || {};
    } catch (error) {
        console.error('Error getting API profiles:', error);
        return {};
    }
}

/**
 * Get a specific API profile by ID
 * @param profileId - The profile ID
 * @returns APIProfile or null
 */
export async function getAPIProfile(profileId: string): Promise<APIProfile | null> {
    try {
        const profiles = await getAPIProfiles();
        return profiles[profileId] || null;
    } catch (error) {
        console.error('Error getting API profile:', error);
        return null;
    }
}

/**
 * Save or update an API profile
 * @param profile - The profile object
 * @returns true if successful
 */
export async function saveAPIProfile(profile: APIProfile): Promise<boolean> {
    try {
        const profiles = await getAPIProfiles();
        profiles[profile.id] = profile;
        await redis.set(API_PROFILES_KEY, profiles);
        return true;
    } catch (error) {
        console.error('Error saving API profile:', error);
        return false;
    }
}

/**
 * Delete an API profile
 * @param profileId - The profile ID to delete
 * @returns true if successful
 */
export async function deleteAPIProfile(profileId: string): Promise<boolean> {
    try {
        const profiles = await getAPIProfiles();
        if (!profiles[profileId]) return false;

        delete profiles[profileId];
        await redis.set(API_PROFILES_KEY, profiles);
        return true;
    } catch (error) {
        console.error('Error deleting API profile:', error);
        return false;
    }
}

/**
 * Update the selected API profile for a specific key
 * @param keyName - The API key name
 * @param profileId - The profile ID to set or null to clear
 * @returns true if successful
 */
export async function setKeySelectedProfile(keyName: string, profileId: string | null): Promise<boolean> {
    try {
        const data = await getKeyData(keyName);
        if (!data) return false;

        if (profileId === null) {
            delete data.selected_api_profile_id;
        } else {
            // Verify profile exists before setting
            const profile = await getAPIProfile(profileId);
            if (!profile) return false;

            data.selected_api_profile_id = profileId;
        }

        await redis.set(keyName, data);
        return true;
    } catch (error) {
        console.error('Error setting key selected profile:', error);
        return false;
    }
}
