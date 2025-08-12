const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

class SupabaseDatabase {
    constructor() {
        this.supabase = null;
    }

    async init() {
        try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            
            if (!supabaseUrl || !supabaseServiceRoleKey) {
                throw new Error('Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
            }
            
            this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            });
            
            console.log('✅ Connected to Supabase database');
            await this.createDefaultAdmin();
            return true;
        } catch (error) {
            console.error('❌ Error initializing Supabase database:', error);
            throw error;
        }
    }

    async createDefaultAdmin() {
        try {
            // Check if admin exists
            const { data: existingAdmin, error: checkError } = await this.supabase
                .from('admin_users')
                .select('id')
                .eq('username', 'admin')
                .single();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
                throw checkError;
            }

            if (!existingAdmin) {
                // Create default admin user
                const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
                const hashedPassword = await bcrypt.hash(defaultPassword, 10);
                
                const { error: insertError } = await this.supabase
                    .from('admin_users')
                    .insert([{
                        username: 'admin',
                        password_hash: hashedPassword,
                        email: 'admin@example.com'
                    }]);

                if (insertError) {
                    throw insertError;
                }

                console.log('✅ Default admin user created (username: admin, password: ' + defaultPassword + ')');
                console.log('⚠️  IMPORTANT: Change the default password after first login!');
            } else {
                console.log('✅ Admin user already exists');
            }
        } catch (error) {
            console.error('❌ Error creating default admin:', error);
            // Don't throw - this is not critical for the app to function
        }
    }

    async getTwilioConfig(userId = null) {
        try {
            if (userId) {
                // Get user-specific config
                const { data, error } = await this.supabase
                    .from('user_twilio_configs')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('is_active', true)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    throw error;
                }

                return data;
            } else {
                // Get system-level config from app_settings
                const configKeys = [
                    'account_sid', 'auth_token', 'api_key', 'api_secret', 
                    'phone_number', 'twiml_app_sid', 'webhook_url'
                ];

                const config = {};
                let hasAnyConfig = false;

                for (const key of configKeys) {
                    const value = await this.getSetting(`twilio_${key}`);
                    if (value) {
                        config[key] = value;
                        hasAnyConfig = true;
                    }
                }

                return hasAnyConfig ? config : null;
            }
        } catch (error) {
            console.error('❌ Error getting Twilio config:', error);
            return null;
        }
    }

    async saveTwilioConfig(config, userId = null) {
        try {
            if (userId) {
                // User-specific config
                // Deactivate old configs for this user
                await this.supabase
                    .from('user_twilio_configs')
                    .update({ is_active: false })
                    .eq('user_id', userId);

                // Insert new config
                const { data, error } = await this.supabase
                    .from('user_twilio_configs')
                    .insert([{
                        user_id: userId,
                        friendly_name: config.friendly_name || 'My Twilio Configuration',
                        account_sid: config.account_sid,
                        auth_token: config.auth_token,
                        api_key: config.api_key,
                        api_secret: config.api_secret,
                        phone_number: config.phone_number,
                        twiml_app_sid: config.twiml_app_sid,
                        webhook_url: config.webhook_url,
                        is_active: true
                    }])
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                console.log('✅ User Twilio configuration saved to Supabase');
                return data;
            } else {
                // System-level config - save to app_settings
                const configData = {
                    account_sid: config.account_sid,
                    auth_token: config.auth_token,
                    api_key: config.api_key,
                    api_secret: config.api_secret,
                    phone_number: config.phone_number,
                    twiml_app_sid: config.twiml_app_sid,
                    webhook_url: config.webhook_url
                };

                // Save each config field as a setting
                for (const [key, value] of Object.entries(configData)) {
                    await this.setSetting(`twilio_${key}`, value, `Twilio ${key} configuration`);
                }

                console.log('✅ System Twilio configuration saved to Supabase');
                return { success: true, config: configData };
            }
        } catch (error) {
            console.error('❌ Error saving Twilio config:', error);
            throw error;
        }
    }

    async validateAdmin(username, password) {
        try {
            const { data: admin, error } = await this.supabase
                .from('admin_users')
                .select('*')
                .eq('username', username)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return false; // User not found
                }
                throw error;
            }

            const isValid = await bcrypt.compare(password, admin.password_hash);
            
            if (isValid) {
                // Update last login
                await this.supabase
                    .from('admin_users')
                    .update({ last_login: new Date().toISOString() })
                    .eq('id', admin.id);

                return {
                    id: admin.id,
                    username: admin.username,
                    email: admin.email
                };
            }

            return false;
        } catch (error) {
            console.error('❌ Error validating admin:', error);
            throw error;
        }
    }

    async updateAdminPassword(username, newPassword) {
        try {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            
            const { error } = await this.supabase
                .from('admin_users')
                .update({ password_hash: hashedPassword })
                .eq('username', username);

            if (error) {
                throw error;
            }

            return true;
        } catch (error) {
            console.error('❌ Error updating admin password:', error);
            throw error;
        }
    }

    async getSetting(key) {
        try {
            const { data, error } = await this.supabase
                .from('app_settings')
                .select('setting_value')
                .eq('setting_key', key)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Setting not found
                }
                throw error;
            }

            return data.setting_value;
        } catch (error) {
            console.error('❌ Error getting setting:', error);
            return null;
        }
    }

    async setSetting(key, value, description = null) {
        try {
            const { data, error } = await this.supabase
                .from('app_settings')
                .upsert([{
                    setting_key: key,
                    setting_value: value,
                    description: description
                }], {
                    onConflict: 'setting_key'
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            console.error('❌ Error setting setting:', error);
            throw error;
        }
    }

    // Recording methods are handled by supabase-server.js
    // These are kept for compatibility but delegate to the existing Supabase recording functions
    async saveRecording(recordingData) {
        console.log('⚠️  Recording operations should use supabase-server.js functions directly');
        return { success: false, message: 'Use Supabase recording functions' };
    }

    async getRecordings(limit = 50) {
        try {
            const { data, error } = await this.supabase
                .from('recordings')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            console.error('❌ Error getting recordings:', error);
            return [];
        }
    }

    async getRecording(recordingSid) {
        try {
            const { data, error } = await this.supabase
                .from('recordings')
                .select('*')
                .eq('recording_sid', recordingSid)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }

            return data;
        } catch (error) {
            console.error('❌ Error getting recording:', error);
            return null;
        }
    }

    async getRecordingsByCallSid(callSid) {
        try {
            const { data, error } = await this.supabase
                .from('recordings')
                .select('*')
                .eq('call_sid', callSid)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            console.error('❌ Error getting recordings by call SID:', error);
            return [];
        }
    }

    async deleteRecording(recordingSid) {
        try {
            const { error } = await this.supabase
                .from('recordings')
                .delete()
                .eq('recording_sid', recordingSid);

            if (error) {
                throw error;
            }

            console.log('✅ Recording deleted from Supabase:', recordingSid);
            return true;
        } catch (error) {
            console.error('❌ Error deleting recording:', error);
            throw error;
        }
    }

    async clearTestRecordings() {
        try {
            // Delete test recordings (you might want to define what constitutes a test recording)
            const { error } = await this.supabase
                .from('recordings')
                .delete()
                .ilike('recording_sid', '%test%');

            if (error) {
                throw error;
            }

            console.log('✅ Test recordings cleared from Supabase');
            return true;
        } catch (error) {
            console.error('❌ Error clearing test recordings:', error);
            throw error;
        }
    }

    // Close method for compatibility - Supabase connections are handled automatically
    close() {
        console.log('ℹ️  Supabase connection closed (handled automatically)');
    }
}

module.exports = SupabaseDatabase; 