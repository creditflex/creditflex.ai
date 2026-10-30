const cfg = require('./config');
const { postJson } = require('./proxy');

// The ONLY place the Array server token is read. Never logged, never sent to the browser.
const serverToken = () => {
  const t = process.env.ARRAY_SERVER_TOKEN;
  if (!t) throw new Error('ARRAY_SERVER_TOKEN is not set');
  return t;
};

const ENROLLMENT_CODES = [
  'idpBundle1Insurance1mmRestoreBundleMonitoring',
  'idpBreachedMonitoring',
  'creditScoreDetails',
  'ppPIPMonitoringAndRemoval',
  'subscriptionManagerEnrichmentAndCancellation',
  'smTxnSrcFinLnk',
  'pioStudentLoanAid',
  'pioStudentLoanAidSubmission',
  'myHomeValueEnterprise',
];

// POST https://array.io/api/authenticate/v2/usertoken (through the proxy)
exports.getUserToken = arrayUserId =>
  postJson(
    'https://array.io/api/authenticate/v2/usertoken',
    { 'x-array-server-token': serverToken() },
    { appKey: cfg.arrayAppKey, userId: arrayUserId, ttlInMinutes: '60' }
  );

// POST https://array.io/api/monitoring/v2/batch (through the proxy)
exports.enrollBatch = async arrayUserId => {
  const r = await postJson(
    'https://array.io/api/monitoring/v2/batch',
    { 'x-array-server-token': serverToken() },
    { userId: arrayUserId, enrollmentCode: ENROLLMENT_CODES }
  );
  console.log('Array enrollment:', r.json && r.json.enrollmentStatus, r.json && r.json.rejectedEnrollments);
  return r;
};
