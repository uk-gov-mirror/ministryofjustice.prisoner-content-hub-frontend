const Sentry = require('@sentry/node');
const request = require('supertest');

const { createApp } = require('../app');
const config = require('../config');
const { logger } = require('../../test/test-helpers');

jest.mock('@sentry/node', () => {
  const errorHandlingMiddleware = jest.fn();
  const requestHandlingMiddleware = jest.fn();
  return {
    init: jest.fn(),
    Handlers: {
      errorHandler: jest.fn(() => (err, req, res, next) => {
        errorHandlingMiddleware();
        next(err);
      }),
      requestHandler: jest.fn(() => (req, res, next) => {
        requestHandlingMiddleware();
        next();
      }),
    },
    captureMessage: jest.fn(),
    errorHandlingMiddleware,
    requestHandlingMiddleware,
  };
});

describe('Sentry', () => {
  it('initializes Sentry', () => {
    app();
    expect(Sentry.init).toHaveBeenCalled();
  });

  it('creates the Sentry error handling middleware', () => {
    app();
    expect(Sentry.Handlers.errorHandler).toHaveBeenCalled();
  });

  it('creates the Sentry request handling middleware', () => {
    app();
    expect(Sentry.Handlers.requestHandler).toHaveBeenCalled();
  });

  it('does not call the Sentry error handling middleware when a request succeeds', async () => {
    await request(app()).get('/games/chess').expect(200);

    expect(Sentry.errorHandlingMiddleware).not.toHaveBeenCalled();
  });

  it('calls the Sentry error handling middleware when an error is thrown', async () => {
    await request(
      app({
        requestLogger: () => (req, res, next) => next('💥'),
      }),
    )
      .get('/games/chess')
      .expect(500);

    expect(Sentry.errorHandlingMiddleware).toHaveBeenCalled();
  });

  it('calls the Sentry request handling middleware when an request is made', async () => {
    await request(app()).get('/games/chess').expect(200);

    expect(Sentry.requestHandlingMiddleware).toHaveBeenCalled();
  });
});

describe('App', () => {
  it('renders a 404 page correctly on invalid url', async () => {
    config.auth.callbackPath = '/testPath';
    await request(app())
      .get('/unknown-url')
      .expect(404)
      .then(res => {
        expect(res.text).toContain(
          'The page you are looking for could not be found',
        );
      });
  });

  it('hides the stack trace on error pages', async () => {
    config.auth.callbackPath = '/testPath';
    const error = {
      message: 'Something has gone horribly wrong',
      stack: 'beep-boop',
    };

    await request(
      app({
        hubFeaturedContentService: {
          hubFeaturedContent: jest.fn().mockRejectedValue(error),
        },
        hubMenuService: {
          tagsMenu: jest.fn().mockResolvedValue({}),
        },
        offenderService: {
          getOffenderDetailsFor: jest.fn().mockResolvedValue({}),
        },
      }),
    )
      .get('/')
      .expect(500)
      .then(response => {
        expect(response.text).not.toContain(
          error.stack,
          'it should not show the error message',
        );
        expect(response.text).not.toContain(
          error.stack,
          'it should not show the stack',
        );
      });
  });

  it('shows the stack trace on error pages', async () => {
    const error = {
      message: 'Something has gone horribly wrong',
      stack: 'beep-boop',
    };
    const previousConfiguration = JSON.stringify(config.features);

    config.auth.callbackPath = '/testPath';
    config.features.showStackTraces = true;

    await request(
      app({
        hubFeaturedContentService: {
          hubFeaturedContent: jest.fn().mockRejectedValue(error),
        },
        offenderService: {
          getEventsListForToday: jest.fn().mockResolvedValue([]),
          getEventsFor: jest.fn().mockResolvedValue([]),
          getOffenderDetailsFor: jest.fn().mockResolvedValue({}),
        },
      }),
    )
      .get('/')
      .expect(500)
      .then(res => {
        expect(res.text).toContain(
          error.message,
          'it should show the error message',
        );
        expect(res.text).toContain(error.stack, 'it should show the stack');

        // restore config
        config.features = JSON.parse(previousConfiguration);
      });
  });

  it('contains the correct security headers per request', async () => {
    config.auth.callbackPath = '/testPath';
    await request(app())
      .get('/')
      .then(res => {
        expect(res.headers).toHaveProperty('x-dns-prefetch-control');
        expect(res.headers).toHaveProperty('x-frame-options');
        expect(res.headers).toHaveProperty('x-download-options');
        expect(res.headers).toHaveProperty('x-content-type-options');
        expect(res.headers).toHaveProperty('x-xss-protection');
      });
  });

  describe('Creating authentication routes', () => {
    const mockSignIn = jest.fn((req, res) => res.send());
    const mockSignOut = jest.fn((req, res) => res.send());
    const createMockSignIn = jest.fn(() => mockSignIn);
    const createMockSignOut = jest.fn(() => mockSignOut);
    const signIn = jest.fn((req, res) => res.send());
    const signInCallback = jest.fn((req, res) => res.send());
    const signOut = jest.fn((req, res) => res.send());
    const createSignInMiddleware = jest.fn(() => signIn);
    const createSignOutMiddleware = jest.fn(() => signOut);
    const createSignInCallbackMiddleware = jest.fn(() => signInCallback);

    // We Stringify/Parse the config to deep-clone and restore before each test
    // This avoids polluting the configuration
    const originalConfig = JSON.stringify(config);
    let testConfig;

    beforeEach(() => {
      testConfig = JSON.parse(originalConfig);
      jest.clearAllMocks();
    });

    it('should use mock middleware when "useMockAuth" is set to true', async () => {
      testConfig.features.useMockAuth = true;

      const application = app({
        config: testConfig,
        authMiddleware: {
          createMockSignIn,
          createMockSignOut,
          createSignInMiddleware,
          createSignOutMiddleware,
          createSignInCallbackMiddleware,
        },
      });

      expect(createMockSignIn).toHaveBeenCalled();
      expect(createMockSignOut).toHaveBeenCalled();

      await request(application)
        .get('/auth/sign-in')
        .then(() => {
          expect(mockSignIn).toHaveBeenCalled();
        });

      await request(application)
        .get('/auth/sign-out')
        .then(() => {
          expect(mockSignOut).toHaveBeenCalled();
        });
    });

    it('should not use mock middleware when "useMockAuth" is set to false', async () => {
      testConfig.features.useMockAuth = false;

      const application = app({
        config: testConfig,
        authMiddleware: {
          createMockSignIn,
          createMockSignOut,
          createSignInMiddleware,
          createSignOutMiddleware,
          createSignInCallbackMiddleware,
        },
      });

      expect(createSignInMiddleware).toHaveBeenCalled();
      expect(createSignInCallbackMiddleware).toHaveBeenCalled();
      expect(createSignOutMiddleware).toHaveBeenCalled();
      expect(createMockSignIn).not.toHaveBeenCalled();
      expect(createMockSignOut).not.toHaveBeenCalled();

      await request(application)
        .get('/auth/sign-in')
        .then(() => {
          expect(signIn).toHaveBeenCalled();
          expect(mockSignIn).not.toHaveBeenCalled();
        });

      await request(application)
        .get('/auth/provider/callback')
        .then(() => {
          expect(signInCallback).toHaveBeenCalled();
        });

      await request(application)
        .get('/auth/sign-out')
        .then(() => {
          expect(signOut).toHaveBeenCalled();
          expect(mockSignOut).not.toHaveBeenCalled();
        });
    });

    it('should default "useMockAuth" to false', async () => {
      const application = app({
        config: testConfig,
        authMiddleware: {
          createMockSignIn,
          createMockSignOut,
          createSignInMiddleware,
          createSignOutMiddleware,
          createSignInCallbackMiddleware,
        },
      });

      expect(createSignInMiddleware).toHaveBeenCalled();
      expect(createSignInCallbackMiddleware).toHaveBeenCalled();
      expect(createSignOutMiddleware).toHaveBeenCalled();
      expect(createMockSignIn).not.toHaveBeenCalled();
      expect(createMockSignOut).not.toHaveBeenCalled();

      await request(application)
        .get('/auth/sign-in')
        .then(() => {
          expect(signIn).toHaveBeenCalled();
          expect(mockSignIn).not.toHaveBeenCalled();
        });

      await request(application)
        .get('/auth/provider/callback')
        .then(() => {
          expect(signInCallback).toHaveBeenCalled();
        });

      await request(application)
        .get('/auth/sign-out')
        .then(() => {
          expect(signOut).toHaveBeenCalled();
          expect(mockSignOut).not.toHaveBeenCalled();
        });
    });
  });
});

function app(opts) {
  const services = {
    hubFeaturedContentService: {
      hubFeaturedContent: jest.fn().mockResolvedValue([]),
    },
    hubMenuService: {
      navigationMenu: jest.fn().mockReturnValue({ topicsMenu: [] }),
    },
    offenderService: {
      getOffenderDetailsFor: jest.fn().mockResolvedValue({}),
    },
    hubContentService: { contentFor: jest.fn().mockResolvedValue({}) },
    searchService: { find: jest.fn() },
    logger,
    requestLogger: () => (req, res, next) => next(),
    ...opts,
  };
  return createApp(services);
}
