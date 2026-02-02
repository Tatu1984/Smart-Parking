/**
 * Node-RED Settings for SParking Metro Integration
 */
module.exports = {
    // Flow file configuration
    flowFile: 'flows.json',
    flowFilePretty: true,

    // User directory for storing node configurations
    userDir: '/data',

    // Admin API settings
    httpAdminRoot: '/',
    httpNodeRoot: '/api',

    // Disable credential encryption for Docker deployment
    // In production, set credentialSecret via environment variable
    credentialSecret: process.env.NODE_RED_CREDENTIAL_SECRET || false,

    // Logging configuration
    logging: {
        console: {
            level: process.env.LOG_LEVEL || "info",
            metrics: false,
            audit: false
        }
    },

    // Editor settings
    editorTheme: {
        projects: {
            enabled: false
        },
        header: {
            title: "SParking - Metro AI Integration"
        }
    },

    // Function node settings
    functionGlobalContext: {
        // Make environment variables available in function nodes
        env: process.env
    },

    // Context storage - use file-based storage for persistence
    contextStorage: {
        default: {
            module: "localfilesystem"
        }
    },

    // Export global context to new nodes
    exportGlobalContextKeys: false,

    // API maximum length
    apiMaxLength: '50mb',

    // Enable runtime diagnostics endpoint
    diagnostics: {
        enabled: true,
        ui: true
    }
};
