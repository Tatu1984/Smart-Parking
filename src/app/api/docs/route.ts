import { NextResponse } from 'next/server'

/**
 * OpenAPI 3.0 Specification for Sparking API
 */
const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Sparking - AI-Powered Smart Parking API',
    description: 'RESTful API for managing parking lots, vehicles, payments, and analytics with AI-powered vehicle detection.',
    version: '1.0.0',
    contact: {
      name: 'Sparking Support',
      email: 'support@sparking.ai'
    },
    license: {
      name: 'Proprietary',
      url: 'https://sparking.ai/license'
    }
  },
  servers: [
    {
      url: '/api',
      description: 'Current server'
    }
  ],
  tags: [
    { name: 'Authentication', description: 'User authentication endpoints' },
    { name: 'Parking Lots', description: 'Parking lot management' },
    { name: 'Zones', description: 'Parking zone operations' },
    { name: 'Tokens', description: 'Parking token/ticket operations' },
    { name: 'Payments', description: 'Payment processing' },
    { name: 'Gates', description: 'Gate/barrier control' },
    { name: 'Displays', description: 'LED/LCD display control' },
    { name: 'Webhooks', description: 'Webhook management' },
    { name: 'Analytics', description: 'Analytics and reporting' },
    { name: 'Find My Car', description: 'Vehicle location service' },
    { name: 'Sync', description: 'Offline sync operations' }
  ],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'User login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 6 }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Login successful' },
          '401': { description: 'Invalid credentials' }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Current user info' },
          '401': { description: 'Unauthorized' }
        }
      }
    },
    '/parking-lots': {
      get: {
        tags: ['Parking Lots'],
        summary: 'List all parking lots',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] } },
          { name: 'city', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'List of parking lots',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    parkingLots: { type: 'array', items: { $ref: '#/components/schemas/ParkingLot' } }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Parking Lots'],
        summary: 'Create a parking lot',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateParkingLot' }
            }
          }
        },
        responses: {
          '201': { description: 'Parking lot created' },
          '400': { description: 'Validation error' }
        }
      }
    },
    '/parking-lots/{id}': {
      get: {
        tags: ['Parking Lots'],
        summary: 'Get parking lot by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Parking lot details' },
          '404': { description: 'Not found' }
        }
      }
    },
    '/parking-lots/{id}/status': {
      get: {
        tags: ['Parking Lots'],
        summary: 'Get real-time status',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Real-time occupancy status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    totalSlots: { type: 'integer' },
                    availableSlots: { type: 'integer' },
                    occupancyRate: { type: 'number' },
                    zones: { type: 'array' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/zones': {
      get: {
        tags: ['Zones'],
        summary: 'List zones',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'parkingLotId', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'List of zones' }
        }
      }
    },
    '/find-car': {
      get: {
        tags: ['Find My Car'],
        summary: 'Locate a parked vehicle',
        parameters: [
          { name: 'token', in: 'query', schema: { type: 'string' }, description: 'Token number' },
          { name: 'plate', in: 'query', schema: { type: 'string' }, description: 'License plate' }
        ],
        responses: {
          '200': {
            description: 'Vehicle location',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    found: { type: 'boolean' },
                    token: { type: 'object' },
                    slot: { type: 'object' },
                    directions: { type: 'object' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/gates': {
      get: {
        tags: ['Gates'],
        summary: 'List all gates',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of gates with status' }
        }
      },
      post: {
        tags: ['Gates'],
        summary: 'Register a new gate',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id', 'name', 'type'],
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['RS485', 'RELAY', 'HTTP', 'MQTT'] },
                  config: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Gate registered' }
        }
      }
    },
    '/gates/{id}': {
      get: {
        tags: ['Gates'],
        summary: 'Get gate status',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Gate status' }
        }
      },
      post: {
        tags: ['Gates'],
        summary: 'Control gate',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action'],
                properties: {
                  action: { type: 'string', enum: ['open', 'close', 'stop'] },
                  duration: { type: 'integer', description: 'Auto-close duration in ms' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Command sent' }
        }
      }
    },
    '/displays': {
      get: {
        tags: ['Displays'],
        summary: 'List all displays',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of displays' }
        }
      }
    },
    '/displays/{id}': {
      post: {
        tags: ['Displays'],
        summary: 'Update display content',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action'],
                properties: {
                  action: { type: 'string', enum: ['message', 'availability', 'zones', 'clear'] },
                  message: { type: 'string' },
                  available: { type: 'integer' },
                  total: { type: 'integer' },
                  zones: { type: 'array' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Display updated' }
        }
      }
    },
    '/webhooks': {
      get: {
        tags: ['Webhooks'],
        summary: 'List webhooks',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of webhooks' }
        }
      },
      post: {
        tags: ['Webhooks'],
        summary: 'Register a webhook',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url', 'events'],
                properties: {
                  url: { type: 'string', format: 'uri' },
                  events: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: [
                        'vehicle.entry', 'vehicle.exit',
                        'payment.completed', 'payment.failed',
                        'slot.occupied', 'slot.vacated',
                        'token.created', 'token.completed',
                        'alert.triggered', 'occupancy.threshold'
                      ]
                    }
                  },
                  parkingLotId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Webhook created with secret' }
        }
      }
    },
    '/analytics/predictive': {
      get: {
        tags: ['Analytics'],
        summary: 'Get predictive analytics',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'parkingLotId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['occupancy', 'peak-hours', 'revenue', 'demand', 'anomalies', 'capacity', 'all'] } },
          { name: 'hoursAhead', in: 'query', schema: { type: 'integer', default: 24 } }
        ],
        responses: {
          '200': { description: 'Predictions data' }
        }
      }
    },
    '/reports': {
      post: {
        tags: ['Analytics'],
        summary: 'Generate PDF report',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['parkingLotId', 'type', 'startDate', 'endDate'],
                properties: {
                  parkingLotId: { type: 'string' },
                  type: { type: 'string', enum: ['transactions', 'occupancy', 'revenue'] },
                  startDate: { type: 'string', format: 'date' },
                  endDate: { type: 'string', format: 'date' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'PDF report',
            content: { 'application/pdf': {} }
          }
        }
      }
    },
    '/graphql': {
      get: {
        tags: ['Analytics'],
        summary: 'GraphQL schema introspection',
        responses: {
          '200': { description: 'Available queries' }
        }
      },
      post: {
        tags: ['Analytics'],
        summary: 'Execute GraphQL query',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: { type: 'string', example: 'dashboardSummary' },
                  variables: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Query result' }
        }
      }
    },
    '/sync': {
      get: {
        tags: ['Sync'],
        summary: 'Get sync status',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'includeOperations', in: 'query', schema: { type: 'boolean' } }
        ],
        responses: {
          '200': { description: 'Sync status' }
        }
      },
      post: {
        tags: ['Sync'],
        summary: 'Perform sync action',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action'],
                properties: {
                  action: { type: 'string', enum: ['force', 'retry', 'clear-completed', 'clear-failed'] },
                  operationId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Action result' }
        }
      }
    },
    '/payments': {
      post: {
        tags: ['Payments'],
        summary: 'Create payment',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tokenId', 'amount'],
                properties: {
                  tokenId: { type: 'string' },
                  amount: { type: 'integer', description: 'Amount in paisa' },
                  method: { type: 'string', enum: ['CASH', 'CARD', 'UPI', 'WALLET'] }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Payment created' }
        }
      }
    },
    '/payments/verify': {
      post: {
        tags: ['Payments'],
        summary: 'Verify Razorpay payment',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['razorpay_payment_id', 'razorpay_order_id', 'razorpay_signature'],
                properties: {
                  razorpay_payment_id: { type: 'string' },
                  razorpay_order_id: { type: 'string' },
                  razorpay_signature: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Payment verified' }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      ParkingLot: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] },
          totalSlots: { type: 'integer' },
          availableSlots: { type: 'integer' }
        }
      },
      CreateParkingLot: {
        type: 'object',
        required: ['name', 'address'],
        properties: {
          name: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          pincode: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' }
        }
      },
      Zone: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          code: { type: 'string' },
          level: { type: 'integer' },
          totalSlots: { type: 'integer' }
        }
      },
      Slot: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          slotNumber: { type: 'string' },
          status: { type: 'string', enum: ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'] },
          type: { type: 'string', enum: ['REGULAR', 'HANDICAPPED', 'EV_CHARGING', 'VIP'] }
        }
      },
      Token: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          tokenNumber: { type: 'string' },
          licensePlate: { type: 'string' },
          entryTime: { type: 'string', format: 'date-time' },
          exitTime: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'EXPIRED', 'LOST', 'CANCELLED'] }
        }
      },
      Payment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          amount: { type: 'integer', description: 'Amount in paisa' },
          method: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'] }
        }
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' }
        }
      }
    }
  }
}

export async function GET() {
  return NextResponse.json(openApiSpec)
}
