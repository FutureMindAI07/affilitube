# Affilitube Test Credentials

## Admin User
- Email: adrian@affilitube.com
- Password: admin123! (preview only — production password unknown; use the password-reset flow on production)
- Tier: pro
- Legacy email admin@affilitube.com auto-migrates to adrian@affilitube.com on backend startup

## Free Test User
- Email: freetest@test.com
- Password: password123
- Tier: free

## Client Test User (read-only access role)
- Email: testclient@brand.com
- Password: clientpass123
- Role: client
- Has assignment to project "Refactor smoke project" (export enabled)
- On login, auto-redirects to /client/project/{id} when they have exactly one active assignment

## YouTube API Key
- Key should be set via YOUTUBE_API_KEY environment variable

## Stripe (Test Mode)
- STRIPE_API_KEY: Set in backend/.env (sk_test_...)
- STRIPE_WEBHOOK_SECRET: Set in backend/.env
- STRIPE_STARTER_MONTHLY_PRICE_ID: price_1TI5ltPnblls1SrQyx2dZ3Ys
- STRIPE_STARTER_ANNUAL_PRICE_ID: price_1TI5uXPnblls1SrQMyKfa2Rh
- STRIPE_PRO_MONTHLY_PRICE_ID: price_1TI5nMPnblls1SrQXoSsJQVK
- STRIPE_PRO_ANNUAL_PRICE_ID: price_1TI5vVPnblls1SrQUtXdR8EJ
