import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const FRONTEND_PORT = 4173;
const FRONTEND_URL = `https://127.0.0.1:${FRONTEND_PORT}`;
const APP_ORIGIN = FRONTEND_URL;
const PYTHON_PROXY_ORIGIN = `${FRONTEND_URL}/python`;

const waitForServer = async (url, timeoutMs = 15000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Frontend not ready yet.
    }
    await delay(250);
  }

  throw new Error(`Timed out waiting for ${url}`);
};

const startFrontend = () => {
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(FRONTEND_PORT)], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: {
      ...process.env,
      CI: '1',
    },
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return child;
};

const portalUser = {
  id: 'user_label_demo',
  email: 'label@saregama.demo',
  displayName: 'Saregama Analyst',
  role: 'manager',
  isPlatformAdmin: false,
  org: {
    id: 'org_label_saregama',
    name: 'Saregama Demo',
    type: 'label',
  },
};

const adminUser = {
  id: 'user_admin_demo',
  email: 'admin@snitch.local',
  displayName: 'Platform Admin',
  role: 'admin',
  isPlatformAdmin: true,
  org: {
    id: 'org_platform_admin',
    name: 'Snitch Platform',
    type: 'platform',
  },
};

const mockReport = {
  id: 'report-1',
  reference: 'REP-TEST01',
  submissionId: 'submission-1',
  venueId: 'venue-1',
  title: 'Test Song',
  artist: 'The Fixtures',
  label: 'Saregama Demo',
  rightsType: 'label',
  matchedTrackConfidence: 0.96,
  deviceTrustBand: 'high',
  estimatedRecoverableValueInr: 265000,
  licenseAssessment: {
    status: 'unlicensed',
    source: 'field-verification',
  },
  analystStatus: 'unreviewed',
  exportStatus: 'not_exported',
  createdAt: '2026-03-07T10:00:00.000Z',
  forensicSummary: '- Music is clearly audible.\n- Venue playback is plausible.\nConclusion: Evidence package is ready for analyst review.',
  merchant: {
    id: 'merchant-1',
    venueId: 'venue-1',
    venueName: 'Demo Club',
    legalEntityName: 'Demo Hospitality LLP',
    gstin: '07ABCDE1234F1Z5',
    cityTier: 'tier_1',
    venueType: 'restaurant_bar_lounge',
  },
  case: {
    id: 'case-1',
    reference: 'CASE-TEST01',
    caseStatus: 'actionable',
    licenseStatus: 'unlicensed',
    planningBand: 'Restaurant, bar, lounge, or pub',
    evidenceCount: 1,
    rewardEligible: true,
    estimatedRecoverableValueInr: 265000,
    realizedValueInr: 0,
    rewardSummary: {
      heldAmountInr: 125,
      paidAmountInr: 0,
    },
    contributor: {
      id: 'contrib-1',
      displayName: 'Delhi Verified Network',
    },
    rewards: [
      {
        id: 'reward-1',
        stage: 'qualified_proof',
        amountInr: 125,
        status: 'held',
      },
    ],
  },
  venue: {
    id: 'venue-1',
    name: 'Demo Club',
    address: 'Connaught Place, New Delhi',
    city: 'New Delhi',
  },
  submission: {
    id: 'submission-1',
    reference: 'SUB-TEST01',
    durationSeconds: 16.2,
    rawVideoUrl: `${FRONTEND_URL}/media/raw-video/demo.webm`,
  },
  reviews: [],
};

const main = async () => {
  const frontend = startFrontend();
  let browser;

  try {
    await waitForServer(FRONTEND_URL);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await page.addInitScript(() => {
      const stream = new globalThis.MediaStream();

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => stream,
        },
      });

      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (success) => success({
            coords: {
              latitude: 28.6328,
              longitude: 77.2197,
              accuracy: 18,
              altitude: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          }),
        },
      });

      class MockMediaRecorder {
        constructor(currentStream, options = {}) {
          this.stream = currentStream;
          this.mimeType = options.mimeType || 'video/webm';
          this.state = 'inactive';
          this.ondataavailable = null;
          this.onstop = null;
        }

        static isTypeSupported(type) {
          return type.startsWith('video/');
        }

        start() {
          this.state = 'recording';
        }

        stop() {
          this.state = 'inactive';
          const blob = new Blob(['snitch-smoke-video'], { type: this.mimeType });
          this.ondataavailable?.({ data: blob });
          this.onstop?.();
        }
      }

      Object.defineProperty(globalThis, 'MediaRecorder', {
        configurable: true,
        value: MockMediaRecorder,
      });
    });

    let submissionStatusPollCount = 0;

    await page.route(`${APP_ORIGIN}/health`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          message: 'Snitch API is running',
          services: {
            acrcloud: { configured: true },
            foursquare: { configured: false },
            gemini: { configured: true },
            google_places: { configured: true },
            storage: { configured: true, mode: 'local_filesystem' },
            auth: { configured: true, mode: 'local_jwt_totp' },
            ffmpeg: { available: true, version: 'ffmpeg smoke build' },
          },
        }),
      });
    });

    await page.route(`${PYTHON_PROXY_ORIGIN}/health`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          service: 'Snitch Local AI Engine',
          model_loaded: true,
          model: 'htdemucs',
          device: 'cpu',
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/capture/install`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          installId: 'install-demo',
          abuseState: { status: 'clear', score: 0 },
          rewardsProgram: {
            mode: 'invite_only',
            rewardsEligible: true,
            contributor: {
              id: 'contrib-1',
              displayName: 'Delhi Verified Network',
              trustTier: 'verified',
              trustTierLabel: 'Verified',
              monthlyPayoutCapInr: 7500,
            },
          },
          capturePolicy: {
            minSeconds: 0.2,
            maxSeconds: 0.5,
            maxUploadBytes: 52428800,
            acceptedMimeTypes: ['video/webm'],
          },
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/capture/time`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          serverTime: new Date().toISOString(),
          clockSkewToleranceMs: 5000,
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/capture/session`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          captureSessionId: 'capture-session-1',
          sessionNonce: 'nonce-1',
          serverTime: new Date().toISOString(),
          clockSkewToleranceMs: 5000,
          capturePolicy: {
            minSeconds: 0.2,
            maxSeconds: 0.5,
          },
          uploadPolicy: {
            maxUploadBytes: 52428800,
            acceptedMimeTypes: ['video/webm'],
          },
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/capture/session/capture-session-1/start`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          captureSessionId: 'capture-session-1',
          startedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/capture/submissions`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          submissionId: 'submission-1',
          reference: 'SUB-TEST01',
          uploadUrl: '/api/capture/submissions/submission-1/upload',
          uploadToken: 'upload-token-1',
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/capture/submissions/submission-1/upload`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assetId: 'asset-1',
          assetUrl: `${FRONTEND_URL}/media/raw-video/demo.webm`,
          submissionId: 'submission-1',
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/capture/submissions/submission-1/finalize`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          submissionId: 'submission-1',
          reference: 'SUB-TEST01',
          status: 'processing',
          abuseScore: 0,
          reportIds: [],
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/capture/submissions/submission-1/status`, async (route) => {
      submissionStatusPollCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          submissionId: 'submission-1',
          reference: 'SUB-TEST01',
          status: submissionStatusPollCount >= 1 ? 'ready' : 'processing',
          reportIds: submissionStatusPollCount >= 1 ? ['report-1'] : [],
          processingError: null,
          finalizedAt: new Date().toISOString(),
          clockSkewFlag: false,
          rewardSummary: {
            eligibleCases: 1,
            estimatedRecoverableValueInr: 265000,
            heldAmountInr: 125,
            paidAmountInr: 0,
          },
          cases: [mockReport.case],
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/auth/demo-accounts`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accounts: [
            { email: portalUser.email, role: portalUser.role, org: portalUser.org.name, totpSecret: 'KRSXG5DSNFXGOIDB' },
            { email: adminUser.email, role: adminUser.role, org: adminUser.org.name, totpSecret: 'JBSWY3DPEHPK3PXP' },
          ],
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/auth/login`, async (route) => {
      const request = route.request();
      const body = request.postDataJSON();
      const session = body.email === adminUser.email
        ? { token: 'admin-token', user: adminUser }
        : { token: 'portal-token', user: portalUser };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session),
      });
    });

    await page.route(`${APP_ORIGIN}/api/auth/me`, async (route) => {
      const authHeader = route.request().headers().authorization || '';
      const user = authHeader.includes('admin-token') ? adminUser : portalUser;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/portal/dashboard`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          org: portalUser.org,
          totals: {
            totalReports: 3,
            confirmedReports: 1,
            eligibleCases: 1,
            estimatedRecoverableValueInr: 265000,
            realizedValueInr: 0,
            heldRewardLiabilityInr: 125,
            uniqueVenues: 1,
            exportedCasePackets: 0,
            confirmationRate: 0.33,
            reportsLast7Days: 2,
            reportsLast30Days: 3,
            reportsLast90Days: 3,
          },
          topRepeatOffenders: [
            {
              venue: mockReport.venue,
              reportCount: 3,
              confirmedCount: 1,
              lastSeenAt: mockReport.createdAt,
              repeatOffenderScore: 8,
              uniqueSongs: 2,
            },
          ],
          topSongs: [
            { title: mockReport.title, artist: mockReport.artist, count: 3 },
          ],
          topCities: [
            { city: 'New Delhi', count: 3 },
          ],
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/portal/reports*`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/portal/reports') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            reports: [mockReport],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          report: mockReport,
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/portal/venues/venue-1`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          venue: mockReport.venue,
          merchant: mockReport.merchant,
          licenseStatuses: [
            {
              id: 'license-1',
              status: 'unlicensed',
              evidenceSource: 'field-verification',
            },
          ],
          coverage: [
            {
              id: 'coverage-1',
              coverageType: 'performance',
              validFrom: '2025-01-01',
              validTo: null,
            },
          ],
          metrics: {
            totalReports: 3,
            confirmedReports: 1,
            repeatOffenderScore: 8,
            uniqueSongs: 2,
            lastSeenAt: mockReport.createdAt,
          },
          cases: [mockReport.case],
          reports: [mockReport],
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/portal/reports/report-1/review`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          reportId: 'report-1',
          analystStatus: 'confirmed',
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/portal/case-packets`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          casePacketId: 'packet-1',
          exportUrl: `${FRONTEND_URL}/media/case-packets/packet-1.json`,
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/portal/cases/case-1/outcome`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          case: {
            ...mockReport.case,
            caseStatus: 'realized',
            realizedValueInr: 250000,
          },
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/admin/health/dependencies`, async (route) => {
      const authHeader = route.request().headers().authorization || '';
      if (!authHeader.includes('admin-token')) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Platform admin access required' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          message: 'Snitch API is running',
          services: {
            acrcloud: { configured: true },
            google_places: { configured: true },
            storage: { configured: true, mode: 'local_filesystem' },
            auth: { configured: true, mode: 'local_jwt_totp' },
            ffmpeg: { available: true, version: 'ffmpeg smoke build' },
          },
          demoAccounts: [
            { email: adminUser.email, role: adminUser.role, org: adminUser.org.name, totpSecret: 'JBSWY3DPEHPK3PXP' },
          ],
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/admin/abuse-queue`, async (route) => {
      const authHeader = route.request().headers().authorization || '';
      if (!authHeader.includes('admin-token')) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Platform admin access required' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          installs: [],
          rejectedSubmissions: [],
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/admin/rewards/overview`, async (route) => {
      const authHeader = route.request().headers().authorization || '';
      if (!authHeader.includes('admin-token')) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Platform admin access required' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: {
            contributors: 2,
            linkedInstalls: 1,
            actionableCases: 1,
            totalEstimatedRecoverableValueInr: 265000,
            totalRealizedValueInr: 0,
            heldRewardsInr: 125,
            paidRewardsInr: 0,
            duplicateRate: 0,
            confirmationRate: 0.5,
            unlicensedHitRate: 0.33,
          },
          contributors: [
            {
              id: 'contrib-1',
              displayName: 'Delhi Verified Network',
              trustTierLabel: 'Verified',
              city: 'New Delhi',
              monthlyPayoutCapInr: 7500,
              currentMonthRewardsInr: 125,
            },
          ],
          recentCases: [mockReport.case],
          recentRewards: [
            {
              id: 'reward-1',
              stage: 'qualified_proof',
              amountInr: 125,
              status: 'held',
            },
          ],
        }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/admin/catalog/import`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ imported: 1 }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/admin/merchant-master/import`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ imported: 1 }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/admin/license-status/import`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ imported: 1 }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/admin/tariffs/import`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ imported: 1 }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/admin/rights/import`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ imported: 1 }),
      });
    });

    await page.route(`${APP_ORIGIN}/api/admin/venue-coverage/import`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ imported: 1 }),
      });
    });

    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    await page.getByText('Turn venue recordings into reviewable enforcement evidence.').waitFor();

    await page.goto(`${FRONTEND_URL}/capture`, { waitUntil: 'networkidle' });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Prepare Device' }).click();
    await page.getByRole('button', { name: 'Start Live Capture' }).click();
    await delay(400);
    await page.getByRole('button', { name: 'Stop Capture' }).click();
    await page.getByText('Reference: SUB-TEST01').waitFor({ state: 'visible', timeout: 10000 });

    await page.goto(`${FRONTEND_URL}/portal`, { waitUntil: 'networkidle' });
    await page.getByLabel('TOTP code').fill('123456');
    await page.getByRole('button', { name: 'Sign in to Portal' }).click();
    await page.getByText('Saregama Demo').waitFor({ state: 'visible' });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Export 1 report/i }).click();
    await page.getByText('Open latest case packet').waitFor({ state: 'visible' });

    await page.getByRole('button', { name: /Log out/i }).click();
    await page.goto(`${FRONTEND_URL}/authority`, { waitUntil: 'networkidle' });
    await page.getByLabel('TOTP code').fill('123456');
    await page.getByRole('button', { name: 'Sign in to Authority Console' }).click();
    await page.getByText('Authority Dashboard').waitFor({ state: 'visible' });
    await page.getByText('Spatial clusters of report activity').waitFor({ state: 'visible' });

    await page.getByRole('button', { name: /Log out/i }).click();
    await page.goto(`${FRONTEND_URL}/admin`, { waitUntil: 'networkidle' });
    await page.getByLabel('TOTP code').fill('654321');
    await page.getByRole('button', { name: 'Sign in to Admin' }).click();
    await page.getByText('Dependency Health').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Import catalog' }).click();
    await page.getByText('Catalog import: imported 1').waitFor({ state: 'visible' });

    console.log('Smoke test passed.');
  } finally {
    if (browser) {
      await browser.close();
    }

    frontend.kill('SIGTERM');
    await delay(300);
    if (!frontend.killed) {
      frontend.kill('SIGKILL');
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
