/**
 * Firebase Firestore Job Queue Module
 * Handles job creation, status updates, and polling for the cloud processing pipeline
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');

// Initialize Firebase Admin SDK
let db = null;

/**
 * Load the Firebase service account from (in order):
 *   FIREBASE_SERVICE_ACCOUNT_JSON  - the JSON document itself
 *   FIREBASE_SERVICE_ACCOUNT_PATH  - path to the JSON file
 *   server/firebase-service-account.json (git-ignored)
 */
function loadServiceAccount() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    }
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
        ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
        : path.join(__dirname, 'firebase-service-account.json');
    return require(serviceAccountPath);
}

function initializeFirebase() {
    if (db) return db;

    try {
        const serviceAccount = loadServiceAccount();

        if (!getApps().length) {
            initializeApp({
                credential: cert(serviceAccount)
            });
        }

        db = getFirestore();
        console.log('✅ Firebase Firestore initialized');
        return db;
    } catch (error) {
        console.error('❌ Failed to initialize Firebase:', error.message);
        throw error;
    }
}

const JOBS_COLLECTION = 'jobs';

/**
 * Job status constants
 */
const JobStatus = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CAPTION_PENDING: 'caption_pending',
    TRANSCRIBING: 'transcribing',
};

/**
 * Create a new job in Firestore
 * @param {Object} jobData - Job data (flexible for different job types)
 * @param {string} [initialStatus] - Optional initial status (default: 'pending')
 * @returns {Promise<string>} - Job ID
 */
async function createJob(jobData, initialStatus = JobStatus.PENDING) {
    const db = initializeFirebase();

    const jobRef = db.collection(JOBS_COLLECTION).doc();
    const jobId = jobRef.id;

    const jobDoc = {
        id: jobId,
        status: initialStatus,
        outputVideoKey: null,
        progress: 0,
        error: null,
        ...jobData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };

    await jobRef.set(jobDoc);
    console.log(`📝 Created job: ${jobId} (status: ${initialStatus})`);

    return jobId;
}

/**
 * Get a job by ID
 * @param {string} jobId
 * @returns {Promise<Object|null>}
 */
async function getJob(jobId) {
    const db = initializeFirebase();

    const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);
    const doc = await jobRef.get();

    if (!doc.exists) {
        return null;
    }

    return doc.data();
}

/**
 * Update job status
 * @param {string} jobId
 * @param {Object} updates
 */
async function updateJob(jobId, updates) {
    const db = initializeFirebase();

    const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);
    await jobRef.update({
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`📝 Updated job ${jobId}:`, updates);
}

/**
 * Mark job as processing
 * @param {string} jobId
 */
async function markJobProcessing(jobId) {
    await updateJob(jobId, { status: JobStatus.PROCESSING });
}

/**
 * Mark job as completed with output video key
 * @param {string} jobId
 * @param {string} outputVideoKey
 */
async function markJobCompleted(jobId, outputVideoKey) {
    await updateJob(jobId, {
        status: JobStatus.COMPLETED,
        outputVideoKey,
        progress: 100,
    });
}

/**
 * Mark job as failed
 * @param {string} jobId
 * @param {string} error
 */
async function markJobFailed(jobId, error) {
    await updateJob(jobId, {
        status: JobStatus.FAILED,
        error,
    });
}

/**
 * Update job progress
 * @param {string} jobId
 * @param {number} progress - 0 to 100
 */
async function updateJobProgress(jobId, progress) {
    await updateJob(jobId, { progress });
}

/**
 * Get pending jobs (for Colab worker)
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function getPendingJobs(limit = 10) {
    const db = initializeFirebase();

    const snapshot = await db.collection(JOBS_COLLECTION)
        .where('status', '==', JobStatus.PENDING)
        .orderBy('createdAt', 'asc')
        .limit(limit)
        .get();

    return snapshot.docs.map(doc => doc.data());
}

/**
 * Test Firebase connection
 * @returns {Promise<boolean>}
 */
async function testConnection() {
    try {
        const db = initializeFirebase();
        // Try to access the jobs collection
        await db.collection(JOBS_COLLECTION).limit(1).get();
        return true;
    } catch (error) {
        console.error('Firebase connection test failed:', error.message);
        return false;
    }
}

/**
 * Delete a job
 * @param {string} jobId
 */
async function deleteJob(jobId) {
    const db = initializeFirebase();
    await db.collection(JOBS_COLLECTION).doc(jobId).delete();
}

module.exports = {
    initializeFirebase,
    createJob,
    getJob,
    updateJob,
    markJobProcessing,
    markJobCompleted,
    markJobFailed,
    updateJobProgress,
    getPendingJobs,
    testConnection,
    deleteJob,
    JobStatus,
};
