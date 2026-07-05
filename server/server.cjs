const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Load environment variables from server directory
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Gemini API Key pool - reuses the existing keys defined later in file
// We forward-declare getGeminiApiKey here, actual definition is at line ~3560
let getGeminiApiKeyFn = null;
let rotateGeminiApiKeyFn = null;

// Helper: Call Gemini using REST API directly 
async function callGeminiForNews(prompt, isSearch = false) {
    // Lazy-load the key functions (they're defined later in file)
    const apiKey = getGeminiApiKeyFn ? getGeminiApiKeyFn() : process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ No Gemini API key available');
        return null;
    }

    try {
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192
            }
        };

        // Add Google Search grounding if requested
        if (isSearch) {
            requestBody.tools = [{ googleSearch: {} }];
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Gemini API Error:', errorData.error?.message || response.status);
            // Try rotating key on error
            if (rotateGeminiApiKeyFn) {
                rotateGeminiApiKeyFn();
            }
            return null;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error('❌ No text in Gemini response');
            return null;
        }

        return text.trim();
    } catch (error) {
        console.error('❌ Gemini API Error:', error.message);
        return null;
    }
}

// Helper: Generate images using Gemini 2.5 Flash Image model (Nano Banana)
async function callGeminiForImageGeneration(prompt) {
    const apiKey = getGeminiApiKeyFn ? getGeminiApiKeyFn() : process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ No Gemini API key available for image generation');
        return null;
    }

    try {
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseModalities: ['TEXT', 'IMAGE']
            }
        };

        console.log('🎨 Calling Gemini gemini-2.5-flash-image for image generation...');

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Gemini Image API Error:', errorData.error?.message || response.status);
            if (rotateGeminiApiKeyFn) {
                rotateGeminiApiKeyFn();
            }
            return null;
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];

        let imageData = null;
        let textResponse = null;

        for (const part of parts) {
            if (part.text) {
                textResponse = part.text;
            } else if (part.inlineData) {
                imageData = {
                    mimeType: part.inlineData.mimeType,
                    data: part.inlineData.data
                };
            }
        }

        if (!imageData) {
            console.error('❌ No image data in Gemini response');
            return null;
        }

        return { imageData, textResponse };
    } catch (error) {
        console.error('❌ Gemini Image API Error:', error.message);
        return null;
    }
}

// Cloud integration modules (optional - only load if configured)
let cloudStorage = null;
let jobQueue = null;

try {
    cloudStorage = require('./cloudStorage.cjs');
    console.log('☁️  cloudStorage module loaded');
} catch (error) {
    console.log('⚠️  cloudStorage not loaded:', error.message);
}

try {
    jobQueue = require('./jobQueue.cjs');
    console.log('☁️  jobQueue module loaded');
} catch (error) {
    console.log('⚠️  jobQueue not loaded:', error.message);
}

if (cloudStorage && jobQueue) {
    console.log('☁️  Cloud modules ready!');
} else {
    console.log('ℹ️  Cloud modules not fully configured (local mode only)');
}

const app = express();
const PORT = 3005; // Changed to 3005 to avoid conflict with frontend

// Middleware
app.use(cors());
app.use(express.json());

// Downloads directory
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Serve static video files
app.use('/api/videos/file', express.static(DOWNLOADS_DIR));
app.use('/downloads', express.static(DOWNLOADS_DIR));

// List all videos in downloads directory
app.get('/api/videos', (req, res) => {
    try {
        const files = fs.readdirSync(DOWNLOADS_DIR);
        const videos = files
            .filter(f => f.endsWith('.mp4') || f.endsWith('.webm'))
            .filter(f => !f.includes('_temp_'))  // Exclude temp files
            .map(filename => {
                const filePath = path.join(DOWNLOADS_DIR, filename);
                const stats = fs.statSync(filePath);
                return {
                    filename,
                    path: `/api/videos/file/${filename}`,
                    size: stats.size,
                    createdAt: stats.birthtime
                };
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.json(videos);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list videos' });
    }
});

// Download endpoint
app.post('/api/download', async (req, res) => {
    const { url, startTime, endTime } = req.body;

    if (!url || !startTime || !endTime) {
        return res.status(400).json({ error: 'Missing required fields: url, startTime, endTime' });
    }

    // Validate YouTube URL
    const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubePattern.test(url)) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const outputFilename = `video_${timestamp}.mp4`;
    const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

    console.log(`Starting download: ${url}`);
    console.log(`Time range: ${startTime} - ${endTime}`);
    console.log(`Output: ${outputPath}`);

    // Build yt-dlp command - force H.264 codec (not AV1) for OpenCV compatibility
    const args = [
        '-f', 'bestvideo[height<=720][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=720][vcodec^=avc]+bestaudio/best[height<=720]',
        '--merge-output-format', 'mp4',
        '--recode-video', 'mp4',  // Re-encode if necessary
        '--download-sections', `*${startTime}-${endTime}`,
        '-o', outputPath,
        url
    ];

    console.log(`Executing: yt-dlp ${args.join(' ')}`);

    const ytdlp = spawn('yt-dlp', args);

    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log(`stdout: ${data}`);
    });

    ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error(`stderr: ${data}`);
    });

    ytdlp.on('close', (code) => {
        console.log(`yt-dlp process exited with code ${code}`);

        if (code !== 0) {
            console.error('Download failed:', stderr);
            return res.status(500).json({
                error: 'Failed to download video',
                details: stderr || stdout
            });
        }

        // Find the actual downloaded file (yt-dlp determines the extension)
        const files = fs.readdirSync(DOWNLOADS_DIR);
        const downloadedFile = files.find(f => f.startsWith(`video_${timestamp}.`));

        if (!downloadedFile) {
            return res.status(500).json({
                error: 'Video file was not created',
                details: stdout + stderr
            });
        }

        res.json({
            success: true,
            filename: downloadedFile,
            videoPath: `/api/videos/${downloadedFile}`,
            message: 'Video downloaded successfully'
        });
    });

    ytdlp.on('error', (error) => {
        console.error('Failed to start yt-dlp:', error);
        res.status(500).json({
            error: 'Failed to start yt-dlp. Make sure yt-dlp is installed.',
            details: error.message
        });
    });
});

// Autocrop endpoint - converts video to vertical format using AI
app.post('/api/autocrop', async (req, res) => {
    const { inputVideo, aspectRatio } = req.body;

    if (!inputVideo) {
        return res.status(400).json({ error: 'Missing required field: inputVideo' });
    }

    const inputPath = path.join(DOWNLOADS_DIR, inputVideo);

    if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ error: 'Input video not found' });
    }

    // Generate output filename
    const timestamp = Date.now();
    const outputFilename = `cropped_${timestamp}.mp4`;
    const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

    console.log(`Starting autocrop: ${inputPath}`);
    console.log(`Aspect ratio: ${aspectRatio}`);
    console.log(`Output: ${outputPath}`);

    // Path to the autocrop Python script
    const autocropDir = path.join(__dirname, 'autocrop-vertical');
    const pythonPath = path.join(autocropDir, 'venv', 'bin', 'python');
    const scriptPath = path.join(autocropDir, 'main.py');

    const args = [
        scriptPath,
        '--input', inputPath,
        '--output', outputPath
    ];

    console.log(`Executing: ${pythonPath} ${args.join(' ')}`);

    const python = spawn(pythonPath, args, { cwd: autocropDir });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log(`stdout: ${data}`);
    });

    python.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error(`stderr: ${data}`);
    });

    python.on('close', (code) => {
        console.log(`Autocrop process exited with code ${code}`);

        if (code !== 0) {
            console.error('Autocrop failed:', stderr);
            return res.status(500).json({
                error: 'Failed to autocrop video',
                details: stderr || stdout
            });
        }

        // Check if file was created
        if (!fs.existsSync(outputPath)) {
            return res.status(500).json({
                error: 'Cropped video file was not created',
                details: stdout + stderr
            });
        }

        res.json({
            success: true,
            filename: outputFilename,
            videoPath: `/api/videos/${outputFilename}`,
            message: 'Video autocropped successfully'
        });
    });

    python.on('error', (error) => {
        console.error('Failed to start autocrop:', error);
        res.status(500).json({
            error: 'Failed to start autocrop. Make sure Python environment is set up.',
            details: error.message
        });
    });
});

// Content Crop endpoint - detects and crops video content area (paulpierre/autocrop)
app.post('/api/content-crop', async (req, res) => {
    const { videoUrl } = req.body;

    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing required field: videoUrl' });
    }

    const timestamp = Date.now();
    const inputFilename = `content_input_${timestamp}.mp4`;
    const outputFilename = `content_cropped_${timestamp}.mp4`;
    const inputPath = path.join(DOWNLOADS_DIR, inputFilename);
    const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

    console.log(`Content Crop: Downloading from ${videoUrl}`);

    try {
        // Step 1: Download the video using yt-dlp
        await new Promise((resolve, reject) => {
            const args = [
                '-f', 'best/bestvideo+bestaudio',
                '--merge-output-format', 'mp4',
                '-o', inputPath,
                videoUrl
            ];

            const ytdlp = spawn('yt-dlp', args);
            let stderr = '';

            ytdlp.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`yt-dlp: ${data}`);
            });

            ytdlp.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`yt-dlp failed: ${stderr}`));
                } else {
                    resolve();
                }
            });

            ytdlp.on('error', reject);
        });

        console.log(`Content Crop: Downloaded to ${inputPath}`);

        // Step 2: Run paulpierre/autocrop
        const autocropDir = path.join(__dirname, 'autocrop-content');
        const pythonPath = path.join(autocropDir, 'venv', 'bin', 'python');
        const scriptPath = path.join(autocropDir, 'autocrop-cli.py');

        await new Promise((resolve, reject) => {
            const args = [
                scriptPath,
                '--video_path', inputPath,
                '--out', outputPath
            ];

            console.log(`Content Crop: Running ${pythonPath} ${args.join(' ')}`);

            const python = spawn(pythonPath, args, { cwd: autocropDir });
            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`autocrop: ${data}`);
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
                console.error(`autocrop stderr: ${data}`);
            });

            python.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Autocrop failed: ${stderr}`));
                } else {
                    resolve();
                }
            });

            python.on('error', reject);
        });

        console.log(`Content Crop: Processed to ${outputPath}`);

        // Check if output exists
        if (!fs.existsSync(outputPath)) {
            throw new Error('Output video was not created');
        }

        res.json({
            success: true,
            filename: outputFilename,
            videoPath: `/api/videos/file/${outputFilename}`,
            message: 'Content area cropped successfully'
        });

    } catch (err) {
        console.error('Content Crop failed:', err);
        // Cleanup input file on error
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }
        res.status(500).json({
            error: 'Failed to crop video content',
            details: err.message
        });
    }
});

// Simple video download for fan edits (no autocrop, just download)
app.post('/api/fan-edit/download', async (req, res) => {
    const { videoUrl } = req.body;

    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing required field: videoUrl' });
    }

    const timestamp = Date.now();
    const outputFilename = `fanedit_${timestamp}.mp4`;
    const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

    console.log(`🎨 Fan Edit: Downloading from ${videoUrl}`);

    try {
        await new Promise((resolve, reject) => {
            const args = [
                '-f', 'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
                '--merge-output-format', 'mp4',
                '-o', outputPath,
                videoUrl
            ];

            const ytdlp = spawn('yt-dlp', args);
            let stderr = '';

            ytdlp.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`yt-dlp: ${data}`);
            });

            ytdlp.stdout.on('data', (data) => {
                console.log(`yt-dlp: ${data}`);
            });

            ytdlp.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`yt-dlp failed with code ${code}: ${stderr}`));
                } else {
                    resolve();
                }
            });

            ytdlp.on('error', reject);
        });

        // Find the actual downloaded file
        const files = fs.readdirSync(DOWNLOADS_DIR);
        const downloadedFile = files.find(f => f.startsWith(`fanedit_${timestamp}`));

        if (!downloadedFile) {
            throw new Error('Downloaded file not found');
        }

        console.log(`🎨 Fan Edit: Download success - ${downloadedFile}`);

        res.json({
            success: true,
            filename: downloadedFile,
            videoPath: `/api/videos/file/${downloadedFile}`,
            message: 'Video downloaded successfully'
        });

    } catch (err) {
        console.error('Fan Edit download failed:', err);
        res.status(500).json({
            error: 'Failed to download video',
            details: err.message
        });
    }
});

// Get list of downloaded videos
app.get('/api/videos', (req, res) => {
    try {
        const files = fs.readdirSync(DOWNLOADS_DIR);
        const videos = files
            .filter(f => f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv'))
            .map(f => ({
                filename: f,
                path: `/api/videos/${f}`,
                size: fs.statSync(path.join(DOWNLOADS_DIR, f)).size
            }));
        res.json(videos);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list videos' });
    }
});

// Delete a video
app.delete('/api/videos/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(DOWNLOADS_DIR, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Video not found' });
    }

    try {
        fs.unlinkSync(filePath);
        res.json({ success: true, message: 'Video deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete video' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// CLOUD PROCESSING ENDPOINTS (Google Colab)
// ============================================

// Check cloud availability
app.get('/api/cloud/status', async (req, res) => {
    if (!cloudStorage || !jobQueue) {
        return res.json({
            available: false,
            message: 'Cloud modules not configured',
        });
    }

    try {
        const r2Connected = await cloudStorage.testConnection();
        const firestoreConnected = await jobQueue.testConnection();

        res.json({
            available: r2Connected && firestoreConnected,
            r2: r2Connected ? 'connected' : 'disconnected',
            firestore: firestoreConnected ? 'connected' : 'disconnected',
        });
    } catch (error) {
        res.json({
            available: false,
            error: error.message,
        });
    }
});

// Upload video to cloud and create processing job
app.post('/api/cloud/upload', async (req, res) => {
    if (!cloudStorage || !jobQueue) {
        return res.status(503).json({
            error: 'Cloud processing not available. Configure R2 and Firebase credentials.',
        });
    }

    const { url, startTime, endTime, aspectRatio } = req.body;

    if (!url || !startTime || !endTime) {
        return res.status(400).json({ error: 'Missing required fields: url, startTime, endTime' });
    }

    // Validate YouTube URL
    const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubePattern.test(url)) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    try {
        // Step 1: Download video locally first (force MP4 format)
        const timestamp = Date.now();
        const outputFilename = `video_${timestamp}.mp4`;
        const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

        console.log(`☁️ Cloud upload: Starting download of ${url}`);

        // Download using yt-dlp - force H.264 codec for OpenCV compatibility
        const downloadResult = await new Promise((resolve, reject) => {
            const args = [
                '-f', 'bestvideo[height<=720][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=720][vcodec^=avc]+bestaudio/best[height<=720]',
                '--merge-output-format', 'mp4',
                '--recode-video', 'mp4',  // Re-encode to H.264 if source is AV1
                '--download-sections', `*${startTime}-${endTime}`,
                '-o', outputPath,
                url
            ];

            const ytdlp = spawn('yt-dlp', args);
            let stderr = '';

            ytdlp.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ytdlp.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`yt-dlp failed: ${stderr}`));
                } else {
                    // Find the actual downloaded file
                    const files = fs.readdirSync(DOWNLOADS_DIR);
                    const downloadedFile = files.find(f => f.startsWith(`video_${timestamp}.`));
                    if (!downloadedFile) {
                        reject(new Error('Downloaded file not found'));
                    } else {
                        resolve(downloadedFile);
                    }
                }
            });

            ytdlp.on('error', reject);
        });

        console.log(`☁️ Cloud upload: Downloaded ${downloadResult}`);

        // Step 2: Upload to R2
        const localFilePath = path.join(DOWNLOADS_DIR, downloadResult);
        const r2Key = `inputs/${timestamp}_${downloadResult}`;

        const uploadResult = await cloudStorage.uploadVideo(localFilePath, `${timestamp}_${downloadResult}`, 'inputs');
        console.log(`☁️ Cloud upload: Uploaded to R2 as ${uploadResult.key}`);

        // Step 3: Create job in Firestore
        const jobId = await jobQueue.createJob({
            inputVideoKey: uploadResult.key,
            aspectRatio: aspectRatio || '9:16',
            youtubeUrl: url,
        });
        console.log(`☁️ Cloud upload: Created job ${jobId}`);

        // Step 4: Clean up local file (optional - keep for debugging)
        // fs.unlinkSync(localFilePath);

        res.json({
            success: true,
            jobId,
            inputVideoKey: uploadResult.key,
            message: 'Video uploaded to cloud. Processing will begin when Colab worker picks up the job.',
        });

    } catch (error) {
        console.error('Cloud upload failed:', error);
        res.status(500).json({
            error: 'Failed to upload video to cloud',
            details: error.message,
        });
    }
});

// Get job status
app.get('/api/cloud/jobs/:jobId', async (req, res) => {
    if (!jobQueue) {
        return res.status(503).json({ error: 'Cloud processing not available' });
    }

    const { jobId } = req.params;

    try {
        const job = await jobQueue.getJob(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // If completed, also get the download URL
        let outputUrl = null;
        if (job.status === 'completed' && job.outputVideoKey && cloudStorage) {
            outputUrl = await cloudStorage.getSignedDownloadUrl(job.outputVideoKey);
        }

        res.json({
            ...job,
            outputUrl,
        });

    } catch (error) {
        console.error('Failed to get job:', error);
        res.status(500).json({
            error: 'Failed to get job status',
            details: error.message,
        });
    }
});

// Get result video URL
app.get('/api/cloud/result/:jobId', async (req, res) => {
    if (!jobQueue || !cloudStorage) {
        return res.status(503).json({ error: 'Cloud processing not available' });
    }

    const { jobId } = req.params;

    try {
        const job = await jobQueue.getJob(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.status !== 'completed') {
            return res.status(400).json({
                error: 'Job not completed',
                status: job.status,
            });
        }

        if (!job.outputVideoKey) {
            return res.status(400).json({ error: 'Output video not available' });
        }

        const downloadUrl = await cloudStorage.getSignedDownloadUrl(job.outputVideoKey);

        res.json({
            success: true,
            downloadUrl,
            outputVideoKey: job.outputVideoKey,
        });

    } catch (error) {
        console.error('Failed to get result:', error);
        res.status(500).json({
            error: 'Failed to get result URL',
            details: error.message,
        });
    }
});

// List recent jobs
app.get('/api/cloud/jobs', async (req, res) => {
    if (!jobQueue) {
        return res.status(503).json({ error: 'Cloud processing not available' });
    }

    try {
        const db = jobQueue.initializeFirebase();
        const snapshot = await db.collection('jobs')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

        const jobs = snapshot.docs.map(doc => doc.data());
        res.json(jobs);

    } catch (error) {
        console.error('Failed to list jobs:', error);
        res.status(500).json({
            error: 'Failed to list jobs',
            details: error.message,
        });
    }
});

// ============================================
// TRANSCRIPTION & CAPTION ENDPOINTS
// ============================================

// Get transcription for a job
app.get('/api/cloud/jobs/:jobId/transcription', async (req, res) => {
    if (!jobQueue) {
        return res.status(503).json({ error: 'Cloud processing not available' });
    }

    const { jobId } = req.params;

    try {
        const job = await jobQueue.getJob(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.status !== 'completed') {
            return res.status(400).json({
                error: 'Job not completed',
                status: job.status,
            });
        }

        if (!job.transcription) {
            return res.status(404).json({ error: 'Transcription not available for this job' });
        }

        res.json({
            success: true,
            transcription: job.transcription,
        });

    } catch (error) {
        console.error('Failed to get transcription:', error);
        res.status(500).json({
            error: 'Failed to get transcription',
            details: error.message,
        });
    }
});

// Generate captioned video
app.post('/api/cloud/jobs/:jobId/generate-captions', async (req, res) => {
    if (!jobQueue) {
        return res.status(503).json({ error: 'Cloud processing not available' });
    }

    const { jobId } = req.params;
    const { font, color, highlightColor, wordsPerSegment, position, customPositionY } = req.body;

    try {
        // Verify parent job exists and has transcription
        const parentJob = await jobQueue.getJob(jobId);

        if (!parentJob) {
            return res.status(404).json({ error: 'Parent job not found' });
        }

        if (parentJob.status !== 'completed') {
            return res.status(400).json({
                error: 'Parent job not completed',
                status: parentJob.status,
            });
        }

        if (!parentJob.transcription) {
            return res.status(400).json({ error: 'Parent job has no transcription' });
        }

        // Create caption generation job
        const captionJobId = await jobQueue.createJob({
            type: 'caption',
            parentJobId: jobId,
            captionSettings: {
                font: font || 'montserrat',
                color: color || 'white',
                highlightColor: highlightColor || 'yellow',
                wordsPerSegment: wordsPerSegment || 4,
                position: position || 'bottom',
                customPositionY: customPositionY || 85,
            },
        }, 'caption_pending');

        console.log(`🎬 Created caption job ${captionJobId} for parent ${jobId}`);

        res.json({
            success: true,
            captionJobId,
            message: 'Caption generation job created. Processing will begin when Colab worker picks it up.',
        });

    } catch (error) {
        console.error('Failed to create caption job:', error);
        res.status(500).json({
            error: 'Failed to create caption job',
            details: error.message,
        });
    }
});

// Get available caption themes
app.get('/api/caption-themes', (req, res) => {
    res.json({
        fonts: [
            { key: 'montserrat', name: 'Montserrat' },
            { key: 'poppins', name: 'Poppins' },
            { key: 'roboto', name: 'Roboto' },
            { key: 'opensans', name: 'Open Sans' },
            { key: 'inter', name: 'Inter' },
            { key: 'bebas', name: 'Bebas Neue' },
            { key: 'oswald', name: 'Oswald' },
            { key: 'anton', name: 'Anton' },
        ],
        colors: [
            { key: 'white', name: 'White', hex: '#FFFFFF' },
            { key: 'black', name: 'Black', hex: '#000000' },
            { key: 'yellow', name: 'Yellow', hex: '#FFFF00' },
            { key: 'red', name: 'Red', hex: '#FF0000' },
            { key: 'cyan', name: 'Cyan', hex: '#00FFFF' },
            { key: 'lime', name: 'Lime', hex: '#00FF00' },
            { key: 'pink', name: 'Pink', hex: '#FF00FF' },
            { key: 'orange', name: 'Orange', hex: '#FF8000' },
        ],
        highlightColors: [
            { key: 'yellow', name: 'Yellow', hex: '#FFFF00' },
            { key: 'cyan', name: 'Cyan', hex: '#00FFFF' },
            { key: 'lime', name: 'Lime', hex: '#00FF00' },
            { key: 'magenta', name: 'Magenta', hex: '#FF00FF' },
            { key: 'orange', name: 'Orange', hex: '#FF8000' },
            { key: 'red', name: 'Red', hex: '#FF0000' },
            { key: 'white', name: 'White', hex: '#FFFFFF' },
            { key: 'gold', name: 'Gold', hex: '#FFD700' },
        ],
    });
});

// ============================================
// AI IMAGE GENERATION ENDPOINTS
// ============================================

// Generate image prompts from transcription using OpenRouter API
app.post('/api/generate-image-prompts', async (req, res) => {
    const { transcription, intervalSeconds = 10 } = req.body;

    if (!transcription || !transcription.words || !transcription.words.length) {
        return res.status(400).json({ error: 'Missing or invalid transcription data' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'OpenRouter API key not configured' });
    }

    try {
        // Get video duration from last word
        const lastWord = transcription.words[transcription.words.length - 1];
        const videoDuration = lastWord.end;

        // Calculate time segments (every intervalSeconds, we generate 2 images)
        const segments = [];
        for (let startTime = 0; startTime < videoDuration; startTime += intervalSeconds) {
            const endTime = Math.min(startTime + intervalSeconds, videoDuration);

            // Get words in this time range
            const wordsInRange = transcription.words.filter(
                w => w.start >= startTime && w.end <= endTime
            );
            const contextText = wordsInRange.map(w => w.word).join(' ');

            if (contextText.trim()) {
                // Generate 2 images for this interval
                segments.push({
                    timeStart: startTime,
                    timeEnd: endTime,
                    context: contextText,
                    imageIndex: 0 // First image
                });
                segments.push({
                    timeStart: startTime,
                    timeEnd: endTime,
                    context: contextText,
                    imageIndex: 1 // Second image
                });
            }
        }

        console.log(`🎨 Generating prompts for ${segments.length} images...`);

        // Free models to try (in order of preference)
        const FREE_MODELS = [
            'meta-llama/llama-3.2-3b-instruct:free',
            'google/gemma-2-9b-it:free',
            'mistralai/mistral-7b-instruct:free',
            'allenai/olmo-3.1-32b-think:free',
            'z-ai/glm-4.5-air:free'
        ];

        // Helper function to try models with fallback
        const generatePromptWithFallback = async (segment) => {
            for (const model of FREE_MODELS) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

                    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                            'HTTP-Referer': 'http://localhost:3005',
                            'X-Title': 'Easy Edits Video Studio'
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: [
                                {
                                    role: 'system',
                                    content: 'You are an expert at creating vivid, detailed image generation prompts. Given a context from a video transcript, create a single compelling image prompt that visually represents the concept. The prompt should be descriptive, artistic, and suitable for AI image generation. Keep it under 100 words. Do not include any explanations, just output the prompt directly.'
                                },
                                {
                                    role: 'user',
                                    content: `Create an image generation prompt for this context (image ${segment.imageIndex + 1} of 2 for this segment, make it different from the other): "${segment.context}"`
                                }
                            ],
                            max_tokens: 150,
                            temperature: 0.8
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        const errorData = await response.json();
                        console.error(`Model ${model} failed:`, errorData.error?.message || 'Unknown error');
                        continue; // Try next model
                    }

                    const data = await response.json();
                    const prompt = data.choices?.[0]?.message?.content?.trim();

                    if (prompt) {
                        console.log(`✅ Used model: ${model}`);
                        return prompt;
                    }
                } catch (err) {
                    if (err.name === 'AbortError') {
                        console.log(`⏱️ Model ${model} timed out, trying next...`);
                    } else {
                        console.error(`Model ${model} error:`, err.message);
                    }
                    continue; // Try next model
                }
            }
            return null; // All models failed
        };

        // Generate prompts using OpenRouter with fallback
        const imagePrompts = [];
        for (const segment of segments) {
            const prompt = await generatePromptWithFallback(segment);

            if (prompt) {
                imagePrompts.push({
                    timeStart: segment.timeStart,
                    timeEnd: segment.timeEnd,
                    context: segment.context,
                    prompt: prompt,
                    imageIndex: segment.imageIndex
                });
                console.log(`✅ Generated prompt for ${segment.timeStart}s-${segment.timeEnd}s (image ${segment.imageIndex + 1})`);
            } else {
                console.error(`❌ All models failed for segment ${segment.timeStart}s-${segment.timeEnd}s`);
            }
        }

        res.json({
            success: true,
            imagePrompts,
            totalSegments: segments.length,
            generatedPrompts: imagePrompts.length
        });

    } catch (error) {
        console.error('Failed to generate image prompts:', error);
        res.status(500).json({
            error: 'Failed to generate image prompts',
            details: error.message
        });
    }
});

// Generate AI images using Pollinations.ai
app.post('/api/generate-ai-images', async (req, res) => {
    const { imagePrompts } = req.body;

    if (!imagePrompts || !imagePrompts.length) {
        return res.status(400).json({ error: 'Missing image prompts' });
    }

    const imagesDir = path.join(DOWNLOADS_DIR, 'ai_images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    console.log(`🎨 Generating ${imagePrompts.length} AI images...`);

    const generatedImages = [];
    const timestamp = Date.now();

    for (let i = 0; i < imagePrompts.length; i++) {
        const promptData = imagePrompts[i];
        try {
            // Build Pollinations URL - URL encode the prompt
            const encodedPrompt = encodeURIComponent(promptData.prompt);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=flux&width=720&height=720&nologo=true&seed=${timestamp + i}`;

            console.log(`📸 Fetching image ${i + 1}/${imagePrompts.length}...`);

            // Download the image
            const response = await fetch(imageUrl);
            if (!response.ok) {
                console.error(`Failed to fetch image: ${response.status}`);
                continue;
            }

            const buffer = await response.arrayBuffer();
            const imageFilename = `ai_image_${timestamp}_${i}.jpg`;
            const imagePath = path.join(imagesDir, imageFilename);

            fs.writeFileSync(imagePath, Buffer.from(buffer));

            generatedImages.push({
                timeStart: promptData.timeStart,
                timeEnd: promptData.timeEnd,
                imageIndex: promptData.imageIndex,
                prompt: promptData.prompt,
                filename: imageFilename,
                localPath: imagePath,
                url: `/api/videos/file/ai_images/${imageFilename}`
            });

            console.log(`✅ Generated image ${i + 1}: ${imageFilename}`);

        } catch (err) {
            console.error(`Failed to generate image ${i}:`, err);
        }
    }

    // Serve ai_images directory
    app.use('/api/videos/file/ai_images', express.static(imagesDir));

    res.json({
        success: true,
        images: generatedImages,
        totalRequested: imagePrompts.length,
        totalGenerated: generatedImages.length
    });
});

// Download a cloud video URL to local storage
app.post('/api/download-cloud-video', async (req, res) => {
    const { videoUrl } = req.body;

    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing videoUrl' });
    }

    // Check if it's already a local file path
    if (!videoUrl.startsWith('http')) {
        const localPath = path.join(DOWNLOADS_DIR, videoUrl);
        if (fs.existsSync(localPath)) {
            return res.json({ success: true, filename: videoUrl, isLocal: true });
        }
    }

    console.log(`📥 Downloading cloud video: ${videoUrl.substring(0, 100)}...`);

    try {
        const response = await fetch(videoUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch video: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const timestamp = Date.now();
        const filename = `cloud_download_${timestamp}.mp4`;
        const localPath = path.join(DOWNLOADS_DIR, filename);

        fs.writeFileSync(localPath, Buffer.from(buffer));
        console.log(`✅ Downloaded to: ${filename}`);

        res.json({
            success: true,
            filename,
            localPath,
            size: buffer.byteLength
        });

    } catch (err) {
        console.error('Cloud video download failed:', err);
        res.status(500).json({
            error: 'Failed to download cloud video',
            details: err.message
        });
    }
});

// Create split-screen video with AI images slideshow
app.post('/api/create-split-video', async (req, res) => {
    const { videoFilename, images, transitionType = 'fade', zoomEffect = 'none', captionsPath } = req.body;

    if (!videoFilename || !images || !images.length) {
        return res.status(400).json({ error: 'Missing required fields: videoFilename, images' });
    }

    let inputPath = path.join(DOWNLOADS_DIR, videoFilename);

    // Check if file exists locally
    if (!fs.existsSync(inputPath)) {
        // Maybe the videoFilename is actually a URL - try to extract just the filename
        const cleanFilename = videoFilename.split('?')[0]; // Remove query params
        inputPath = path.join(DOWNLOADS_DIR, cleanFilename);

        if (!fs.existsSync(inputPath)) {
            // List available videos for debugging
            const availableVideos = fs.readdirSync(DOWNLOADS_DIR)
                .filter(f => f.endsWith('.mp4') || f.endsWith('.webm'))
                .slice(0, 5);

            console.error(`Video not found: ${videoFilename}`);
            console.error(`Checked path: ${inputPath}`);
            console.error(`Available videos: ${availableVideos.join(', ')}`);

            return res.status(404).json({
                error: `Input video not found: ${videoFilename}`,
                availableVideos,
                checkedPath: inputPath
            });
        }
    }

    const timestamp = Date.now();
    const outputFilename = `split_screen_${timestamp}.mp4`;
    const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

    console.log(`🎬 Creating split-screen video...`);
    console.log(`  Input: ${inputPath}`);
    console.log(`  Images: ${images.length}`);
    console.log(`  Transition: ${transitionType}`);
    console.log(`  Zoom: ${zoomEffect}`);

    // Create a Python script to handle the complex video composition
    const pythonScript = path.join(__dirname, 'split_screen_composer.py');

    // Check if script exists
    if (!fs.existsSync(pythonScript)) {
        return res.status(500).json({
            error: 'Split-screen composer script not found. Please ensure split_screen_composer.py exists.'
        });
    }

    // Prepare images data as JSON file for the Python script
    const imagesDataPath = path.join(DOWNLOADS_DIR, `images_data_${timestamp}.json`);
    fs.writeFileSync(imagesDataPath, JSON.stringify(images, null, 2));

    try {
        await new Promise((resolve, reject) => {
            const args = [
                pythonScript,
                '--input', inputPath,
                '--output', outputPath,
                '--images-data', imagesDataPath,
                '--transition', transitionType,
                '--zoom', zoomEffect
            ];

            if (captionsPath) {
                args.push('--captions', captionsPath);
            }

            // Use system Python or venv Python
            const pythonPath = fs.existsSync(path.join(__dirname, 'venv', 'bin', 'python'))
                ? path.join(__dirname, 'venv', 'bin', 'python')
                : 'python3';

            console.log(`Executing: ${pythonPath} ${args.join(' ')}`);

            const python = spawn(pythonPath, args, { cwd: __dirname });
            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`split_screen: ${data}`);
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
                console.error(`split_screen stderr: ${data}`);
            });

            python.on('close', (code) => {
                // Clean up temp files
                if (fs.existsSync(imagesDataPath)) {
                    fs.unlinkSync(imagesDataPath);
                }

                if (code !== 0) {
                    reject(new Error(`Split screen failed: ${stderr}`));
                } else {
                    resolve();
                }
            });

            python.on('error', reject);
        });

        if (!fs.existsSync(outputPath)) {
            throw new Error('Output video was not created');
        }

        res.json({
            success: true,
            filename: outputFilename,
            videoPath: `/api/videos/file/${outputFilename}`,
            message: 'Split-screen video created successfully'
        });

    } catch (err) {
        console.error('Split-screen creation failed:', err);
        res.status(500).json({
            error: 'Failed to create split-screen video',
            details: err.message
        });
    }
});

// Get transition and zoom effect options
app.get('/api/split-screen-options', (req, res) => {
    res.json({
        transitions: [
            { key: 'fade', name: 'Fade', description: 'Smooth fade between images' },
            { key: 'wipe', name: 'Wipe', description: 'Slide transition' },
            { key: 'zoom', name: 'Zoom', description: 'Zoom in/out transition' },
            { key: 'none', name: 'None', description: 'No transition' }
        ],
        zoomEffects: [
            { key: 'ken_burns', name: 'Ken Burns', description: 'Slow pan and zoom effect' },
            { key: 'zoom_in', name: 'Zoom In', description: 'Gradually zoom into image' },
            { key: 'zoom_out', name: 'Zoom Out', description: 'Gradually zoom out of image' },
            { key: 'none', name: 'None', description: 'No zoom effect' }
        ]
    });
});

// ============================================
// TEXT HIGHLIGHTER ENDPOINTS
// ============================================

// Configure multer for image uploads
const highlightUploadDir = path.join(DOWNLOADS_DIR, 'highlight_uploads');
if (!fs.existsSync(highlightUploadDir)) {
    fs.mkdirSync(highlightUploadDir, { recursive: true });
}

const highlightStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, highlightUploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `highlight_${timestamp}${ext}`);
    }
});

const highlightUpload = multer({
    storage: highlightStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PNG, JPG, and WEBP are allowed.'));
        }
    }
});

// Text Highlight endpoint - creates animated highlight videos from screenshots
app.post('/api/text-highlight', highlightUpload.array('images', 10), async (req, res) => {
    const { targetText, color = 'yellow', duration = '0.4' } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No images uploaded' });
    }

    if (!targetText || !targetText.trim()) {
        // Cleanup uploaded files
        files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
        return res.status(400).json({ error: 'Missing required field: targetText' });
    }

    const timestamp = Date.now();
    const pythonPath = path.join(__dirname, 'venv', 'bin', 'python');
    const scriptPath = path.join(__dirname, 'text_highlighter.py');

    console.log(`🖍️  Text Highlight: Processing ${files.length} image(s)`);
    console.log(`   Target text: "${targetText}"`);
    console.log(`   Color: ${color}, Duration: ${duration}s`);

    try {
        const results = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const outputFilename = `highlight_${timestamp}_${i}.mp4`;
            const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

            console.log(`   Processing image ${i + 1}/${files.length}: ${file.filename}`);

            await new Promise((resolve, reject) => {
                const args = [
                    scriptPath,
                    '--image_path', file.path,
                    '--target_text', targetText,
                    '--output', outputPath,
                    '--color', color,
                    '--duration', duration.toString(),
                    '--json_output'
                ];

                console.log(`   Executing: python ${args.slice(1).join(' ')}`);

                const python = spawn(pythonPath, args, { cwd: __dirname });
                let stdout = '';
                let stderr = '';

                python.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                python.stderr.on('data', (data) => {
                    stderr += data.toString();
                    console.log(`   python: ${data}`);
                });

                python.on('close', (code) => {
                    if (code !== 0) {
                        console.error(`   Text highlight failed for ${file.filename}:`, stderr);
                        reject(new Error(stderr || 'Unknown error'));
                    } else {
                        try {
                            const result = JSON.parse(stdout);
                            if (result.success) {
                                results.push({
                                    inputImage: file.filename,
                                    outputVideo: outputFilename,
                                    videoPath: `/api/videos/file/${outputFilename}`,
                                    boxes: result.boxes
                                });
                                resolve();
                            } else {
                                reject(new Error(result.error || 'Processing failed'));
                            }
                        } catch (e) {
                            reject(new Error(`Failed to parse output: ${stdout}`));
                        }
                    }
                });

                python.on('error', reject);
            });
        }

        // Cleanup uploaded images after processing
        files.forEach(f => {
            if (fs.existsSync(f.path)) {
                fs.unlinkSync(f.path);
            }
        });

        console.log(`🖍️  Text Highlight: Completed ${results.length} video(s)`);

        res.json({
            success: true,
            results,
            message: `Generated ${results.length} highlight video(s)`
        });

    } catch (err) {
        console.error('Text highlight failed:', err);

        // Cleanup uploaded files on error
        files.forEach(f => {
            if (fs.existsSync(f.path)) {
                fs.unlinkSync(f.path);
            }
        });

        res.status(500).json({
            error: 'Failed to create highlight video',
            details: err.message
        });
    }
});

// Get highlight color options
app.get('/api/text-highlight/colors', (req, res) => {
    res.json({
        colors: [
            { key: 'yellow', name: 'Yellow', hex: '#FFFF00', description: 'Classic highlighter' },
            { key: 'blue', name: 'Blue', hex: '#6495ED', description: 'Tech/calm feel' },
            { key: 'green', name: 'Green', hex: '#00FF7F', description: 'Fresh/positive' },
            { key: 'pink', name: 'Pink', hex: '#FF69B4', description: 'Vibrant/fun' },
            { key: 'orange', name: 'Orange', hex: '#FFA500', description: 'Energetic' }
        ]
    });
});

// ============================================
// CREATE CONTENT - AI SCRIPT & RESOURCE GENERATOR
// ============================================

// OpenRouter API key for content creation (uses existing env var)
const CONTENT_API_KEY = process.env.OPENROUTER_API_KEY;

// Generate video script using OpenRouter Mistral AI
app.post('/api/create-content/script', async (req, res) => {
    const { topic, comment } = req.body;

    if (!topic || !topic.trim()) {
        return res.status(400).json({ error: 'Missing required field: topic' });
    }

    console.log(`🎬 Create Content: Generating script for "${topic}"`);
    if (comment) console.log(`   With feedback: "${comment}"`);

    const pythonPath = fs.existsSync(path.join(__dirname, 'venv', 'bin', 'python'))
        ? path.join(__dirname, 'venv', 'bin', 'python')
        : 'python3';
    const scriptPath = path.join(__dirname, 'content_creator.py');

    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
        return res.status(500).json({
            error: 'content_creator.py not found. Please ensure it exists in the server directory.'
        });
    }

    try {
        await new Promise((resolve, reject) => {
            const args = [
                scriptPath,
                '--action', 'script',
                '--topic', topic,
                '--api_key', CONTENT_API_KEY
            ];

            if (comment && comment.trim()) {
                args.push('--comment', comment);
            }

            console.log(`   Executing: python ${args.slice(1).join(' ')}`);

            const python = spawn(pythonPath, args, { cwd: __dirname });
            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`   content_creator: ${data}`);
            });

            python.on('close', (code) => {
                if (code !== 0) {
                    console.error(`   Script generation failed:`, stderr);
                    reject(new Error(stderr || 'Script generation failed'));
                } else {
                    try {
                        const result = JSON.parse(stdout);
                        if (result.success) {
                            res.json(result);
                        } else {
                            reject(new Error(result.error || 'Unknown error'));
                        }
                        resolve();
                    } catch (e) {
                        reject(new Error(`Failed to parse output: ${stdout}`));
                    }
                }
            });

            python.on('error', reject);
        });

    } catch (err) {
        console.error('Script generation failed:', err);
        res.status(500).json({
            error: 'Failed to generate script',
            details: err.message
        });
    }
});

// Find resources using OpenRouter Mistral AI
app.post('/api/create-content/resources', async (req, res) => {
    const { topic, comment } = req.body;

    if (!topic || !topic.trim()) {
        return res.status(400).json({ error: 'Missing required field: topic' });
    }

    console.log(`🔍 Create Content: Finding resources for "${topic}"`);
    if (comment) console.log(`   With feedback: "${comment}"`);

    const pythonPath = fs.existsSync(path.join(__dirname, 'venv', 'bin', 'python'))
        ? path.join(__dirname, 'venv', 'bin', 'python')
        : 'python3';
    const scriptPath = path.join(__dirname, 'content_creator.py');

    if (!fs.existsSync(scriptPath)) {
        return res.status(500).json({
            error: 'content_creator.py not found.'
        });
    }

    try {
        await new Promise((resolve, reject) => {
            const args = [
                scriptPath,
                '--action', 'resources',
                '--topic', topic,
                '--api_key', CONTENT_API_KEY
            ];

            if (comment && comment.trim()) {
                args.push('--comment', comment);
            }

            console.log(`   Executing: python ${args.slice(1).join(' ')}`);

            const python = spawn(pythonPath, args, { cwd: __dirname });
            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`   content_creator: ${data}`);
            });

            python.on('close', (code) => {
                if (code !== 0) {
                    console.error(`   Resource finding failed:`, stderr);
                    reject(new Error(stderr || 'Resource finding failed'));
                } else {
                    try {
                        const result = JSON.parse(stdout);
                        if (result.success) {
                            res.json(result);
                        } else {
                            reject(new Error(result.error || 'Unknown error'));
                        }
                        resolve();
                    } catch (e) {
                        reject(new Error(`Failed to parse output: ${stdout}`));
                    }
                }
            });

            python.on('error', reject);
        });

    } catch (err) {
        console.error('Resource finding failed:', err);
        res.status(500).json({
            error: 'Failed to find resources',
            details: err.message
        });
    }
});

// ============================================
// AUDIO GENERATION - SPEECHIFY TTS API
// ============================================

const SPEECHIFY_API_KEY = process.env.SPEECHIFY_API_KEY || '';
const SPEECHIFY_API_BASE = 'https://api.sws.speechify.com';

// Get available voices from Speechify
app.get('/api/audio/voices', async (req, res) => {
    console.log('🎙️ Audio: Fetching available voices...');

    try {
        const response = await fetch(`${SPEECHIFY_API_BASE}/v1/voices`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SPEECHIFY_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Speechify API error: ${response.status} - ${errorText}`);
        }

        const voices = await response.json();

        // Filter and format voices for short-form content
        // Prioritize English voices with good energy for social media
        const formattedVoices = voices
            .filter(v => v.locale && v.locale.startsWith('en'))
            .map(v => ({
                id: v.id,
                name: v.display_name,
                gender: v.gender,
                locale: v.locale,
                preview: v.preview_audio,
                tags: v.tags || []
            }))
            .slice(0, 20); // Limit to 20 voices

        console.log(`🎙️ Audio: Found ${formattedVoices.length} English voices`);

        res.json({
            success: true,
            voices: formattedVoices
        });

    } catch (err) {
        console.error('Voice fetch failed:', err);
        res.status(500).json({
            error: 'Failed to fetch voices',
            details: err.message
        });
    }
});

// Generate audio from script using Speechify
app.post('/api/audio/generate', async (req, res) => {
    const { script, plainScript, voiceId, speed = 'medium', isSSML = false } = req.body;

    if (!script || !script.trim()) {
        return res.status(400).json({ error: 'Missing required field: script' });
    }

    if (!voiceId) {
        return res.status(400).json({ error: 'Missing required field: voiceId' });
    }

    const displayScript = plainScript || script.substring(0, 100);
    console.log(`🎙️ Audio: Generating audio (${script.length} chars, SSML: ${isSSML})`);
    console.log(`   Voice: ${voiceId}, Speed: ${speed}`);
    console.log(`   Preview: ${displayScript.substring(0, 80)}...`);

    // Prepare the input for Speechify
    let speechifyInput = script.trim();

    // Check if script already has <speak> tags using regex (more reliable)
    const speakTagRegex = /^\s*<speak[\s>]/i;
    const alreadyHasSpeak = speakTagRegex.test(speechifyInput);

    console.log(`   SSML detection: isSSML=${isSSML}, alreadyHasSpeak=${alreadyHasSpeak}`);

    if (isSSML || alreadyHasSpeak) {
        // SSML already provided - use as-is (already has prosody, emotions, etc.)
        console.log(`   Using SSML script directly`);

        // Ensure the script is clean - no nested speak tags
        if (alreadyHasSpeak) {
            // Remove outer speak tags if present, we'll add them cleanly
            speechifyInput = speechifyInput
                .replace(/^\s*<speak[^>]*>/i, '')
                .replace(/<\/speak>\s*$/i, '')
                .trim();
            // Wrap in clean speak tags
            speechifyInput = `<speak>${speechifyInput}</speak>`;
        }
    } else {
        // Plain text - wrap in basic speak tags with rate adjustment
        let ssmlRate;
        switch (speed) {
            case 'slow': ssmlRate = '0.9'; break;
            case 'fast': ssmlRate = '1.2'; break;
            case 'very-fast': ssmlRate = '1.35'; break;
            default: ssmlRate = '1.05';
        }
        speechifyInput = `<speak><prosody rate="${ssmlRate}">${script}</prosody></speak>`;
        console.log(`   Wrapped plain text in SSML with rate=${ssmlRate}`);
    }

    try {
        console.log(`   Calling Speechify API...`);

        const requestBody = {
            input: speechifyInput,
            voice_id: voiceId
        };

        console.log(`   Request body preview: ${JSON.stringify(requestBody).substring(0, 300)}...`);

        const response = await fetch(`${SPEECHIFY_API_BASE}/v1/audio/speech`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SPEECHIFY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`   Speechify error response: ${errorText}`);
            throw new Error(`Speechify API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Determine file extension from response format (default is wav)
        const audioFormat = result.audio_format || 'wav';

        // Save audio file
        const timestamp = Date.now();
        const audioFilename = `voiceover_${timestamp}.${audioFormat}`;
        const audioPath = path.join(DOWNLOADS_DIR, audioFilename);

        // Decode base64 audio and save
        const audioBuffer = Buffer.from(result.audio_data, 'base64');
        fs.writeFileSync(audioPath, audioBuffer);

        console.log(`🎙️ Audio: Generated ${audioFilename} (${audioBuffer.length} bytes)`);

        res.json({
            success: true,
            filename: audioFilename,
            audioPath: `/api/videos/file/${audioFilename}`,
            duration: result.duration_seconds || null,
            message: 'Audio generated successfully'
        });

    } catch (err) {
        console.error('Audio generation failed:', err);
        res.status(500).json({
            error: 'Failed to generate audio',
            details: err.message
        });
    }
});

// ============================================
// B-ROLL FINDER - STOCK FOOTAGE/IMAGES
// ============================================

// API Keys for multiple stock media sources
// Pexels: https://www.pexels.com/api/
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || 'YOUR_PEXELS_API_KEY_HERE';
const PEXELS_API_BASE = 'https://api.pexels.com';

// Pixabay: https://pixabay.com/api/docs/ (100 req/min)
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || 'YOUR_PIXABAY_API_KEY_HERE';
const PIXABAY_API_BASE = 'https://pixabay.com/api';

// Unsplash: https://unsplash.com/developers (50 req/hr - photos only)
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || 'YOUR_UNSPLASH_ACCESS_KEY_HERE';
const UNSPLASH_API_BASE = 'https://api.unsplash.com';

// Extract visual keywords from script using AI
app.post('/api/broll/extract-keywords', async (req, res) => {
    const { script } = req.body;

    if (!script || !script.trim()) {
        return res.status(400).json({ error: 'Missing required field: script' });
    }

    console.log(`🎬 B-Roll: Extracting keywords from script (${script.length} chars)`);

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3005',
                'X-Title': 'B-Roll Finder'
            },
            body: JSON.stringify({
                model: 'mistralai/mistral-7b-instruct:free',
                messages: [{
                    role: 'user',
                    content: `You are a video editor finding B-Roll footage for a short-form video.

Analyze this script and extract 6-8 visual keywords/phrases that would make great B-Roll footage.

SCRIPT:
"${script.substring(0, 1000)}"

Requirements:
- Focus on VISUAL concepts (things you can film/photograph)
- Include both specific objects and abstract concepts
- Think about what viewers would expect to see
- Mix of: people, places, objects, actions, tech, abstract

Return a JSON object with:
{
    "keywords": ["keyword1", "keyword2", ...],
    "categories": ["tech", "business", "lifestyle"]
}

Return ONLY the JSON, no other text.`
                }],
                max_tokens: 500,
                temperature: 0.7
            })
        });

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || '';

        // Parse JSON from response
        let result;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found');
            }
        } catch (e) {
            // Fallback: extract words manually
            result = {
                keywords: content.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 2).slice(0, 8),
                categories: ['general']
            };
        }

        console.log(`🎬 B-Roll: Extracted ${result.keywords?.length || 0} keywords`);

        res.json({
            success: true,
            keywords: result.keywords || [],
            categories: result.categories || []
        });

    } catch (err) {
        console.error('Keyword extraction failed:', err);
        res.status(500).json({
            error: 'Failed to extract keywords',
            details: err.message
        });
    }
});

// Search Pexels for photos or videos
app.get('/api/broll/search', async (req, res) => {
    const { query, type = 'photos', page = 1, per_page = 15 } = req.query;

    if (!query) {
        return res.status(400).json({ error: 'Missing required parameter: query' });
    }

    if (PEXELS_API_KEY === 'YOUR_PEXELS_API_KEY_HERE') {
        return res.status(400).json({
            error: 'Pexels API key not configured',
            message: 'Please set PEXELS_API_KEY environment variable or update server.cjs'
        });
    }

    console.log(`🎬 B-Roll: Searching ${type} for "${query}"`);

    try {
        const endpoint = type === 'videos'
            ? `${PEXELS_API_BASE}/videos/search`
            : `${PEXELS_API_BASE}/v1/search`;

        const response = await fetch(
            `${endpoint}?query=${encodeURIComponent(query)}&page=${page}&per_page=${per_page}&orientation=portrait`,
            {
                headers: {
                    'Authorization': PEXELS_API_KEY
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Pexels API error: ${response.status}`);
        }

        const data = await response.json();

        // Format results consistently
        let results;
        if (type === 'videos') {
            results = (data.videos || []).map(v => ({
                id: v.id,
                type: 'video',
                thumbnail: v.image,
                preview: v.video_files?.find(f => f.quality === 'sd')?.link || v.video_files?.[0]?.link,
                download: v.video_files?.find(f => f.quality === 'hd')?.link || v.video_files?.[0]?.link,
                duration: v.duration,
                width: v.width,
                height: v.height,
                photographer: v.user?.name || 'Unknown',
                pexels_url: v.url
            }));
        } else {
            results = (data.photos || []).map(p => ({
                id: p.id,
                type: 'photo',
                thumbnail: p.src?.small || p.src?.tiny,
                preview: p.src?.medium,
                download: p.src?.large2x || p.src?.original,
                width: p.width,
                height: p.height,
                photographer: p.photographer,
                pexels_url: p.url
            }));
        }

        console.log(`🎬 B-Roll: Found ${results.length} ${type}`);

        res.json({
            success: true,
            query,
            type,
            total: data.total_results || 0,
            page: parseInt(page),
            results
        });

    } catch (err) {
        console.error('Pexels search failed:', err);
        res.status(500).json({
            error: 'Failed to search Pexels',
            details: err.message
        });
    }
});

// Download B-Roll asset to server
app.post('/api/broll/download', async (req, res) => {
    const { url, filename, type = 'video' } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Missing required field: url' });
    }

    console.log(`🎬 B-Roll: Downloading ${type} from Pexels`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const extension = type === 'video' ? 'mp4' : 'jpg';
        const finalFilename = filename || `broll_${Date.now()}.${extension}`;
        const filePath = path.join(DOWNLOADS_DIR, finalFilename);

        fs.writeFileSync(filePath, Buffer.from(buffer));

        console.log(`🎬 B-Roll: Saved ${finalFilename} (${buffer.byteLength} bytes)`);

        res.json({
            success: true,
            filename: finalFilename,
            path: `/api/videos/file/${finalFilename}`,
            size: buffer.byteLength
        });

    } catch (err) {
        console.error('B-Roll download failed:', err);
        res.status(500).json({
            error: 'Failed to download asset',
            details: err.message
        });
    }
});

// Combined multi-source B-Roll search
app.get('/api/broll/search-all', async (req, res) => {
    const { query, type = 'photos', per_page = 6 } = req.query;

    if (!query) {
        return res.status(400).json({ error: 'Missing required parameter: query' });
    }

    console.log(`🎬 B-Roll: Multi-source search for "${query}" (${type})`);

    const results = [];
    const errors = [];

    // Helper function to search Pexels
    const searchPexels = async () => {
        if (PEXELS_API_KEY === 'YOUR_PEXELS_API_KEY_HERE') return [];
        try {
            const endpoint = type === 'videos'
                ? `${PEXELS_API_BASE}/videos/search`
                : `${PEXELS_API_BASE}/v1/search`;

            const response = await fetch(
                `${endpoint}?query=${encodeURIComponent(query)}&per_page=${per_page}&orientation=portrait`,
                { headers: { 'Authorization': PEXELS_API_KEY } }
            );

            if (!response.ok) return [];
            const data = await response.json();

            if (type === 'videos') {
                return (data.videos || []).map(v => ({
                    id: `pexels_${v.id}`,
                    source: 'pexels',
                    type: 'video',
                    thumbnail: v.image,
                    preview: v.video_files?.find(f => f.quality === 'sd')?.link || v.video_files?.[0]?.link,
                    download: v.video_files?.find(f => f.quality === 'hd')?.link || v.video_files?.[0]?.link,
                    duration: v.duration,
                    width: v.width,
                    height: v.height,
                    photographer: v.user?.name || 'Unknown',
                    source_url: v.url
                }));
            } else {
                return (data.photos || []).map(p => ({
                    id: `pexels_${p.id}`,
                    source: 'pexels',
                    type: 'photo',
                    thumbnail: p.src?.small,
                    preview: p.src?.medium,
                    download: p.src?.large2x || p.src?.original,
                    width: p.width,
                    height: p.height,
                    photographer: p.photographer,
                    source_url: p.url
                }));
            }
        } catch (e) {
            errors.push({ source: 'pexels', error: e.message });
            return [];
        }
    };

    // Helper function to search Pixabay
    const searchPixabay = async () => {
        if (PIXABAY_API_KEY === 'YOUR_PIXABAY_API_KEY_HERE') return [];
        try {
            const endpoint = type === 'videos'
                ? `${PIXABAY_API_BASE}/videos/`
                : `${PIXABAY_API_BASE}/`;

            const response = await fetch(
                `${endpoint}?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&per_page=${per_page}&orientation=vertical`
            );

            if (!response.ok) return [];
            const data = await response.json();

            if (type === 'videos') {
                return (data.hits || []).map(v => ({
                    id: `pixabay_${v.id}`,
                    source: 'pixabay',
                    type: 'video',
                    thumbnail: `https://i.vimeocdn.com/video/${v.picture_id}_295x166.jpg`,
                    preview: v.videos?.small?.url,
                    download: v.videos?.medium?.url || v.videos?.large?.url,
                    duration: v.duration,
                    width: v.videos?.medium?.width || 1920,
                    height: v.videos?.medium?.height || 1080,
                    photographer: v.user,
                    source_url: v.pageURL
                }));
            } else {
                return (data.hits || []).map(p => ({
                    id: `pixabay_${p.id}`,
                    source: 'pixabay',
                    type: 'photo',
                    thumbnail: p.previewURL,
                    preview: p.webformatURL,
                    download: p.largeImageURL,
                    width: p.imageWidth,
                    height: p.imageHeight,
                    photographer: p.user,
                    source_url: p.pageURL
                }));
            }
        } catch (e) {
            errors.push({ source: 'pixabay', error: e.message });
            return [];
        }
    };

    // Helper function to search Unsplash (photos only)
    const searchUnsplash = async () => {
        if (UNSPLASH_ACCESS_KEY === 'YOUR_UNSPLASH_ACCESS_KEY_HERE') return [];
        if (type === 'videos') return []; // Unsplash doesn't have videos

        try {
            const response = await fetch(
                `${UNSPLASH_API_BASE}/search/photos?query=${encodeURIComponent(query)}&per_page=${per_page}&orientation=portrait`,
                { headers: { 'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
            );

            if (!response.ok) return [];
            const data = await response.json();

            return (data.results || []).map(p => ({
                id: `unsplash_${p.id}`,
                source: 'unsplash',
                type: 'photo',
                thumbnail: p.urls?.small,
                preview: p.urls?.regular,
                download: p.urls?.full,
                width: p.width,
                height: p.height,
                photographer: p.user?.name || 'Unknown',
                source_url: p.links?.html
            }));
        } catch (e) {
            errors.push({ source: 'unsplash', error: e.message });
            return [];
        }
    };

    // Execute all searches in parallel
    const [pexelsResults, pixabayResults, unsplashResults] = await Promise.all([
        searchPexels(),
        searchPixabay(),
        searchUnsplash()
    ]);

    // Merge and interleave results for variety
    const allResults = [];
    const maxLen = Math.max(pexelsResults.length, pixabayResults.length, unsplashResults.length);

    for (let i = 0; i < maxLen; i++) {
        if (pexelsResults[i]) allResults.push(pexelsResults[i]);
        if (pixabayResults[i]) allResults.push(pixabayResults[i]);
        if (unsplashResults[i]) allResults.push(unsplashResults[i]);
    }

    console.log(`🎬 B-Roll: Found ${allResults.length} total (Pexels: ${pexelsResults.length}, Pixabay: ${pixabayResults.length}, Unsplash: ${unsplashResults.length})`);

    res.json({
        success: true,
        query,
        type,
        results: allResults,
        sources: {
            pexels: pexelsResults.length,
            pixabay: pixabayResults.length,
            unsplash: unsplashResults.length
        },
        errors: errors.length > 0 ? errors : undefined
    });
});

// ============================================
// MUSIC VIDEO PROCESSING ENDPOINTS
// ============================================

// Video filter definitions with FFmpeg filter strings
const VIDEO_FILTERS = {
    // Retro/Vintage
    vhs: 'colorbalance=rs=0.3:gs=-0.05:bs=-0.1,noise=alls=20:allf=t+u,eq=contrast=1.1:brightness=0.05',
    film_grain: 'noise=alls=15:allf=t,eq=saturation=0.9:contrast=1.1',
    '8mm': 'colorbalance=rs=0.2:gs=0.1:bs=-0.2,noise=alls=25:allf=t+u,vignette=PI/4',
    sepia: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
    kodak: 'colorbalance=rs=0.15:gs=0.05:bs=-0.1,eq=saturation=1.2:brightness=0.03',
    vintage: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,eq=brightness=0.05', // Fan edits vintage
    // Aesthetic
    coquette: 'colorbalance=rs=0.2:gs=-0.05:bs=0.1,eq=saturation=0.9:brightness=0.05',
    y2k: 'eq=saturation=1.4:contrast=1.2,colorbalance=rs=0.1:gs=0.05:bs=0.15',
    dreamy: 'gblur=sigma=1.5,eq=brightness=0.1:saturation=0.85',
    dreamcore: 'eq=saturation=0.7:brightness=0.1,gblur=sigma=1', // Fan edits dreamcore
    lofi: 'eq=saturation=0.7:contrast=0.9:brightness=-0.05,colorbalance=rs=-0.05:gs=0.05:bs=0.1',
    golden_hour: 'colorbalance=rs=0.25:gs=0.1:bs=-0.15,eq=saturation=1.1:brightness=0.08',
    golden: 'colorbalance=rs=0.25:gs=0.1:bs=-0.15,eq=saturation=1.1:brightness=0.08', // Fan edits golden
    // Color Grading
    warm_glow: 'colorbalance=rs=0.2:gs=0.1:bs=-0.1,eq=brightness=0.05',
    cool_tones: 'colorbalance=rs=-0.15:gs=0:bs=0.2,eq=saturation=0.95',
    cinematic: 'eq=contrast=1.3:saturation=0.9,colorbalance=rs=-0.05:gs=-0.05:bs=0.1',
    high_contrast: 'eq=contrast=1.5:saturation=1.1',
    desaturated: 'eq=saturation=0.5',
    // Effects
    glitch: 'rgbashift=rh=-3:bh=3,noise=alls=10:allf=t',
    neon_glow: 'eq=saturation=1.8:contrast=1.3,colorbalance=rs=0.1:gs=-0.1:bs=0.2',
    vignette: 'vignette=PI/4',
    blur_edges: 'vignette=PI/3,gblur=sigma=2',
    chromatic: 'rgbashift=rh=5:bh=-5',
};

// Caption style FFmpeg configurations
const CAPTION_STYLES = {
    karaoke: { fontsize: 48, fontcolor: 'white', borderw: 2, bordercolor: 'black' },
    bounce: { fontsize: 52, fontcolor: 'white', borderw: 3, bordercolor: 'black' },
    wave: { fontsize: 46, fontcolor: 'white', borderw: 2, bordercolor: 'black' },
    neon_glow: { fontsize: 50, fontcolor: 'cyan', shadowcolor: 'cyan', shadowx: 0, shadowy: 0 },
    typewriter: { fontsize: 40, fontcolor: 'white', font: 'monospace', borderw: 1, bordercolor: 'black' },
    scale_pop: { fontsize: 56, fontcolor: 'white', borderw: 3, bordercolor: 'black' },
    stroke_outline: { fontsize: 52, fontcolor: 'white', borderw: 4, bordercolor: 'black' },
    shadow_3d: { fontsize: 50, fontcolor: 'white', shadowcolor: 'black', shadowx: 4, shadowy: 4 },
    gradient_fill: { fontsize: 48, fontcolor: 'white', borderw: 2, bordercolor: 'black' },
};

// Download music video from URL
app.post('/api/music-video/download', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Missing required field: url' });
    }

    const timestamp = Date.now();
    const outputFilename = `music_${timestamp}.mp4`;
    const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

    console.log(`🎵 Music Download: Starting download from ${url}`);

    try {
        await new Promise((resolve, reject) => {
            const args = [
                '-f', 'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
                '--merge-output-format', 'mp4',
                '-o', outputPath,
                url
            ];

            const ytdlp = spawn('yt-dlp', args);
            let stderr = '';

            ytdlp.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`yt-dlp: ${data}`);
            });

            ytdlp.stdout.on('data', (data) => {
                console.log(`yt-dlp: ${data}`);
            });

            ytdlp.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`yt-dlp failed with code ${code}: ${stderr}`));
                } else {
                    resolve();
                }
            });

            ytdlp.on('error', reject);
        });

        // Find the actual downloaded file
        const files = fs.readdirSync(DOWNLOADS_DIR);
        const downloadedFile = files.find(f => f.startsWith(`music_${timestamp}`));

        if (!downloadedFile) {
            throw new Error('Downloaded file not found');
        }

        console.log(`🎵 Music Download: Success - ${downloadedFile}`);

        res.json({
            success: true,
            filename: downloadedFile,
            videoPath: `/api/videos/file/${downloadedFile}`,
            message: 'Video downloaded successfully'
        });

    } catch (err) {
        console.error('Music Download failed:', err);
        res.status(500).json({
            error: 'Failed to download video',
            details: err.message
        });
    }
});

// Get available filters
app.get('/api/music-video/filters', (req, res) => {
    const filters = Object.keys(VIDEO_FILTERS).map(key => ({
        key,
        ffmpeg: VIDEO_FILTERS[key]
    }));
    res.json({ filters });
});

// Apply filter to video (preview or full)
// Apply filter to video (preview or full) - Supports Timeline!
app.post('/api/music-video/apply-filter', async (req, res) => {
    const { videoFilename, filter, timeline, intensity = 1.0 } = req.body;

    if (!videoFilename) {
        console.error('❌ Missing fields. Received body:', req.body);
        return res.status(400).json({ error: 'Missing required fields: videoFilename' });
    }

    if (!filter && (!timeline || !Array.isArray(timeline) || timeline.length === 0)) {
        return res.status(400).json({ error: 'Missing required fields: filter OR timeline' });
    }

    const inputPath = path.join(DOWNLOADS_DIR, videoFilename);
    if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ error: 'Input video not found' });
    }

    const timestamp = Date.now();
    // Use first filter key for naming if simple, or "multi" if timeline
    const filterName = timeline ? 'multi' : filter;
    const outputFilename = `filtered_${filterName}_${timestamp}.mp4`;
    const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

    console.log(`🎨 Applying filter logic to ${videoFilename}`);

    try {
        let filterComplex = '';

        if (timeline && timeline.length > 0) {
            // --- Timeline Logic ---
            const filterChains = [];

            timeline.forEach(item => {
                const { filterKey, key, start, end } = item;
                // Support both key and filterKey for compatibility
                const actualKey = filterKey || key;
                const baseFilter = VIDEO_FILTERS[actualKey];

                if (baseFilter) {
                    // Split base filter into components (e.g. "eq=...,noise=...")
                    // Note: This simple split works because our presets don't nest commas inside properties
                    // If they did, we'd need a smarter regex.
                    const parts = baseFilter.split(',');

                    const timeBoundParts = parts.map(part => {
                        // Check if it already has an enable clause (unlikely for presets)
                        if (part.includes(':enable=')) return part;
                        return `${part}:enable='between(t,${start},${end})'`;
                    });

                    filterChains.push(timeBoundParts.join(','));
                } else {
                    console.warn(`⚠️ Warning: Unknown filter key '${actualKey}' in timeline item`);
                }
            });

            filterComplex = filterChains.join(',');
            console.log(`   Timeline Filters: ${timeline.length} segments`);
        } else {
            // --- Legacy Single Filter Logic ---
            const baseFilter = VIDEO_FILTERS[filter];
            if (!baseFilter) {
                return res.status(400).json({ error: `Unknown filter: ${filter}` });
            }
            filterComplex = baseFilter;
        }

        console.log(`   Filter string: ${filterComplex}`);

        await new Promise((resolve, reject) => {
            const args = [
                '-i', inputPath,
                '-vf', filterComplex,
                '-map', '0:v',           // Explicitly map video stream
                '-map', '0:a?',          // Explicitly map audio stream (if present)
                '-c:v', 'libx264',      // Specify H.264 video codec
                '-pix_fmt', 'yuv420p',   // Ensure compatibility with all players
                '-preset', 'fast',       // Fast encoding
                '-crf', '23',            // Quality setting
                '-c:a', 'aac',           // Re-encode audio as AAC
                '-b:a', '128k',          // Audio bitrate
                '-movflags', '+faststart', // Enable streaming
                '-y',
                outputPath
            ];

            console.log(`   FFmpeg command: ffmpeg ${args.join(' ')}`);

            const ffmpeg = spawn('ffmpeg', args);
            let stderr = '';

            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code !== 0) {
                    console.error(`FFmpeg stderr: ${stderr.slice(-500)}`);
                    reject(new Error(`FFmpeg failed with code ${code}`));
                } else {
                    resolve();
                }
            });

            ffmpeg.on('error', reject);
        });

        // Verify output file exists and has content
        if (!fs.existsSync(outputPath)) {
            throw new Error('Output file was not created');
        }

        const stats = fs.statSync(outputPath);
        if (stats.size < 1000) {
            throw new Error('Output file is too small, may be corrupted');
        }

        console.log(`🎨 Filter applied: ${outputFilename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

        res.json({
            success: true,
            filename: outputFilename,
            videoPath: `/api/videos/file/${outputFilename}`
        });

    } catch (err) {
        console.error('Filter application failed:', err);
        res.status(500).json({
            error: 'Failed to apply filter',
            details: err.message
        });
    }
});

// Full music video processing pipeline with YOLO-based 9:16 crop (person stays in frame)
app.post('/api/music-video/process', async (req, res) => {
    const {
        videoFilename,
        filter,
        filterIntensity = 1.0,
        captionStyle,
        captionText,
        captionFont = 'montserrat',
        captionColor = 'white',
        captionPosition = 'bottom',
        captionSize = 48,
        aiFeatures = {},
        useColab = false  // New: Use Colab GPU for processing
    } = req.body;

    if (!videoFilename) {
        return res.status(400).json({ error: 'Missing required field: videoFilename' });
    }

    const inputPath = path.join(DOWNLOADS_DIR, videoFilename);
    if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ error: 'Input video not found' });
    }

    const timestamp = Date.now();

    console.log(`🎵 Music Video Processing: ${videoFilename}`);
    console.log(`  Mode: ${useColab ? 'Colab GPU' : 'Local'}`);
    console.log(`  Filter: ${filter || 'none'}`);
    console.log(`  Caption: ${captionStyle || 'none'}`);

    // ==============================
    // COLAB GPU MODE - Create Firebase job
    // ==============================
    if (useColab && jobQueue && cloudStorage) {
        try {
            // Upload to R2
            const r2Key = `inputs/music_${timestamp}_${videoFilename}`;
            await cloudStorage.uploadVideo(inputPath, `music_${timestamp}_${videoFilename}`, 'inputs');

            // Create job in Firebase
            const jobId = await jobQueue.createJob({
                type: 'music_video',
                inputVideoKey: r2Key,
                filter: filter,
                filterIntensity: filterIntensity,
                captionStyle: captionStyle,
                captionText: captionText,
                captionFont: captionFont,
                captionColor: captionColor,
                captionPosition: captionPosition,
                captionSize: captionSize,
                aiFeatures: aiFeatures
            });

            console.log(`☁️ Created Colab music job: ${jobId}`);

            return res.json({
                success: true,
                mode: 'colab',
                jobId: jobId,
                message: 'Music video job created. Processing will begin when Colab worker picks it up.'
            });
        } catch (err) {
            console.error('Colab job creation failed:', err);
            return res.status(500).json({
                error: 'Failed to create Colab job',
                details: err.message
            });
        }
    }

    // ==============================
    // LOCAL MODE - Use autocrop-vertical with YOLO
    // ==============================
    try {
        // Step 1: Run YOLO-based autocrop (person tracking)
        const croppedFilename = `music_cropped_${timestamp}.mp4`;
        const croppedPath = path.join(DOWNLOADS_DIR, croppedFilename);

        console.log(`🎬 Step 1: YOLO Autocrop (keeping person in frame)...`);

        const autocropDir = path.join(__dirname, 'autocrop-vertical');
        const pythonPath = path.join(autocropDir, 'venv', 'bin', 'python');
        const scriptPath = path.join(autocropDir, 'main.py');

        await new Promise((resolve, reject) => {
            const args = [
                scriptPath,
                '--input', inputPath,
                '--output', croppedPath,
                '--aspect', '9:16'
            ];

            console.log(`   Running: ${pythonPath} ${args.join(' ')}`);

            const python = spawn(pythonPath, args, { cwd: autocropDir });
            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`   ${data.toString().trim()}`);
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            python.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Autocrop failed with code ${code}: ${stderr}`));
                } else {
                    resolve();
                }
            });

            python.on('error', reject);
        });

        if (!fs.existsSync(croppedPath)) {
            throw new Error('YOLO autocrop did not create output file');
        }

        console.log(`✅ YOLO Autocrop complete: ${croppedFilename}`);

        // Step 2: Apply filter if selected
        let currentVideoPath = croppedPath;
        if (filter && VIDEO_FILTERS[filter]) {
            console.log(`🎨 Step 2: Applying filter '${filter}'...`);

            const filteredFilename = `music_filtered_${timestamp}.mp4`;
            const filteredPath = path.join(DOWNLOADS_DIR, filteredFilename);

            await new Promise((resolve, reject) => {
                const args = [
                    '-i', currentVideoPath,
                    '-vf', VIDEO_FILTERS[filter],
                    '-c:a', 'copy',
                    '-y',
                    filteredPath
                ];

                const ffmpeg = spawn('ffmpeg', args);
                let stderr = '';

                ffmpeg.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                ffmpeg.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`FFmpeg filter failed: ${stderr.slice(-300)}`));
                    } else {
                        resolve();
                    }
                });

                ffmpeg.on('error', reject);
            });

            currentVideoPath = filteredPath;
            console.log(`✅ Filter applied: ${filteredFilename}`);
        }

        // Step 3: Burn captions if selected
        const outputFilename = `music_final_${timestamp}.mp4`;
        const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

        if (captionStyle && captionText) {
            console.log(`📝 Step 3: Burning captions with style '${captionStyle}'...`);

            const captionConfig = MOTIVATIONAL_CAPTION_STYLES[captionStyle] || CAPTION_STYLES.karaoke;
            const colorMap = {
                white: 'white', black: 'black', yellow: 'yellow', cyan: 'cyan',
                magenta: 'magenta', lime: 'lime', red: 'red', orange: 'orange',
                pink: 'pink', gold: 'gold'
            };
            const textColor = colorMap[captionColor] || 'white';

            const yPosition = captionPosition === 'top' ? 'h*0.1' :
                captionPosition === 'center' ? '(h-text_h)/2' : 'h*0.85-text_h';

            const escapedText = captionText.replace(/'/g, "'\\''").replace(/:/g, '\\:');

            const drawtext = `drawtext=text='${escapedText}':fontsize=${captionSize}:fontcolor=${textColor}:borderw=${captionConfig.borderw || 2}:bordercolor=black:x=(w-text_w)/2:y=${yPosition}`;

            await new Promise((resolve, reject) => {
                const args = [
                    '-i', currentVideoPath,
                    '-vf', drawtext,
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-y',
                    outputPath
                ];

                const ffmpeg = spawn('ffmpeg', args);
                let stderr = '';

                ffmpeg.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                ffmpeg.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Caption burn failed: ${stderr.slice(-300)}`));
                    } else {
                        resolve();
                    }
                });

                ffmpeg.on('error', reject);
            });

            console.log(`✅ Captions burned`);
        } else {
            // No captions, just copy the current video
            fs.copyFileSync(currentVideoPath, outputPath);
        }

        // Cleanup intermediate files
        if (fs.existsSync(croppedPath) && croppedPath !== outputPath) {
            fs.unlinkSync(croppedPath);
        }
        if (currentVideoPath !== croppedPath && currentVideoPath !== outputPath && fs.existsSync(currentVideoPath)) {
            fs.unlinkSync(currentVideoPath);
        }

        console.log(`🎵 Music Video Processing complete: ${outputFilename}`);

        res.json({
            success: true,
            mode: 'local',
            filename: outputFilename,
            videoPath: `/api/videos/file/${outputFilename}`,
            message: 'Music video processed with YOLO person tracking'
        });

    } catch (err) {
        console.error('Music video processing failed:', err);
        res.status(500).json({
            error: 'Failed to process music video',
            details: err.message
        });
    }
});

// Transcribe video audio using Whisper (for caption generation)
app.post('/api/music-video/transcribe', async (req, res) => {
    const { videoFilename } = req.body;

    if (!videoFilename) {
        return res.status(400).json({ error: 'Missing required field: videoFilename' });
    }

    const inputPath = path.join(DOWNLOADS_DIR, videoFilename);
    if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ error: 'Input video not found' });
    }

    console.log(`🎤 Transcribing video: ${videoFilename}`);

    // For local transcription, we need whisper installed
    // First, extract audio from video
    const timestamp = Date.now();
    const audioPath = path.join(DOWNLOADS_DIR, `audio_${timestamp}.wav`);

    try {
        // Step 1: Extract audio
        console.log('   Extracting audio...');
        await new Promise((resolve, reject) => {
            const args = [
                '-i', inputPath,
                '-vn',
                '-acodec', 'pcm_s16le',
                '-ar', '16000',
                '-ac', '1',
                '-y',
                audioPath
            ];

            const ffmpeg = spawn('ffmpeg', args);
            let stderr = '';

            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Audio extraction failed: ${stderr.slice(-200)}`));
                } else {
                    resolve();
                }
            });

            ffmpeg.on('error', reject);
        });

        // Step 2: Run Whisper transcription
        console.log('   Running Whisper transcription...');

        // Check if whisper is available (try local python with whisper)
        const whisperResult = await new Promise((resolve, reject) => {
            // Use whisper CLI if installed, otherwise suggest Colab
            const whisperArgs = [
                '-c',
                `import whisper; import json; ` +
                `model = whisper.load_model('base'); ` +
                `result = model.transcribe('${audioPath}', word_timestamps=True); ` +
                `words = [{'word': w['word'].strip(), 'start': round(w['start'], 3), 'end': round(w['end'], 3)} for s in result.get('segments', []) for w in s.get('words', [])]; ` +
                `print(json.dumps({'text': result['text'], 'language': result['language'], 'words': words}))`
            ];

            const python = spawn('python3', whisperArgs);
            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            python.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Whisper transcription failed. Install whisper: pip install openai-whisper. Error: ${stderr.slice(-200)}`));
                } else {
                    try {
                        resolve(JSON.parse(stdout.trim()));
                    } catch (e) {
                        reject(new Error(`Failed to parse Whisper output: ${stdout}`));
                    }
                }
            });

            python.on('error', () => {
                reject(new Error('Whisper not available locally. Use Colab mode for transcription.'));
            });
        });

        // Cleanup audio file
        if (fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
        }

        console.log(`✅ Transcription complete: ${whisperResult.words?.length || 0} words`);

        res.json({
            success: true,
            transcription: whisperResult,
            message: 'Video transcribed successfully'
        });

    } catch (err) {
        // Cleanup on error
        if (fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
        }

        console.error('Transcription failed:', err);
        res.status(500).json({
            error: 'Failed to transcribe video',
            details: err.message,
            suggestion: 'For local transcription, install whisper: pip install openai-whisper. Or use Colab GPU mode.'
        });
    }
});

// AI Beat Detection endpoint (basic tempo analysis)
app.post('/api/music-video/ai-beat-detect', async (req, res) => {
    const { videoFilename } = req.body;

    if (!videoFilename) {
        return res.status(400).json({ error: 'Missing required field: videoFilename' });
    }

    const inputPath = path.join(DOWNLOADS_DIR, videoFilename);
    if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ error: 'Input video not found' });
    }

    // For now, return mock beat data
    // TODO: Implement actual beat detection using FFmpeg audio analysis or librosa
    console.log(`🎵 AI Beat Detection for ${videoFilename}`);

    // Generate mock beat timestamps (every ~0.5 seconds for a typical 100-120 BPM song)
    const mockBeats = [];
    for (let i = 0; i < 60; i += 0.5) {
        mockBeats.push({
            time: i,
            strength: Math.random() > 0.7 ? 'strong' : 'weak'
        });
    }

    res.json({
        success: true,
        beats: mockBeats,
        estimatedBPM: 110,
        message: 'Beat detection completed (mock data - implement librosa for real detection)'
    });
});

// AI Filter Suggestion based on audio mood
app.post('/api/music-video/ai-suggest-filter', async (req, res) => {
    const { videoFilename, mood } = req.body;

    // Simple mood-to-filter mapping
    const moodFilters = {
        energetic: ['y2k', 'neon_glow', 'high_contrast', 'glitch'],
        chill: ['lofi', 'dreamy', 'desaturated', 'cool_tones'],
        romantic: ['coquette', 'golden_hour', 'warm_glow', 'film_grain'],
        nostalgic: ['vhs', 'sepia', '8mm', 'kodak'],
        dark: ['cinematic', 'vignette', 'high_contrast', 'desaturated'],
        happy: ['y2k', 'golden_hour', 'warm_glow', 'kodak']
    };

    const selectedMood = mood || 'energetic';
    const suggestions = moodFilters[selectedMood] || moodFilters.energetic;

    res.json({
        success: true,
        mood: selectedMood,
        suggestedFilters: suggestions,
        message: 'Filter suggestions based on mood'
    });
});

// ============================================
// MOTIVATIONAL CONTENT GENERATOR ENDPOINTS
// ============================================

// Hook Library - Pre-built viral hooks organized by style
const HOOK_LIBRARY = {
    curiosity: [
        "Nobody is talking about this...",
        "I discovered something that changed everything...",
        "The 1% know this secret...",
        "What they don't teach you in school...",
        "The hidden truth about success..."
    ],
    personal: [
        "If you're watching this, it's a sign...",
        "Stop scrolling. This is for YOU.",
        "Your future self will thank you for watching this...",
        "I wish someone told me this sooner...",
        "This message found you for a reason..."
    ],
    challenge: [
        "They said it couldn't be done...",
        "Everyone doubted me, but...",
        "I was broke, broken, and hopeless...",
        "Rock bottom taught me this...",
        "When everything fell apart..."
    ],
    wisdom: [
        "2000 years ago, a philosopher said...",
        "The ancient Stoics knew this truth...",
        "This simple truth took me 10 years to learn...",
        "Marcus Aurelius wrote this in his journal...",
        "The most powerful lesson I ever learned..."
    ],
    urgent: [
        "You need to hear this right now...",
        "Before it's too late, understand this...",
        "This could change your life in 60 seconds...",
        "Pay attention. This is important.",
        "The next 30 seconds could change everything..."
    ]
};

// Visual Style Presets for different moods
const VISUAL_STYLE_PRESETS = {
    dark_mode: {
        name: 'Dark Mode',
        description: 'High contrast, dramatic',
        searchTerms: ['dark clouds', 'storm', 'night city', 'shadows'],
        musicMood: 'epic',
        filter: 'cinematic'
    },
    sunrise: {
        name: 'Sunrise',
        description: 'Warm golden tones',
        searchTerms: ['sunrise', 'golden hour', 'morning light', 'dawn'],
        musicMood: 'peaceful',
        filter: 'golden_hour'
    },
    nature: {
        name: 'Nature',
        description: 'Forest, ocean, mountains',
        searchTerms: ['forest', 'ocean waves', 'mountains', 'waterfall'],
        musicMood: 'ambient',
        filter: 'dreamy'
    },
    urban: {
        name: 'Urban',
        description: 'City, hustle footage',
        searchTerms: ['city timelapse', 'busy street', 'skyscraper', 'traffic'],
        musicMood: 'lofi',
        filter: 'lofi'
    },
    minimal: {
        name: 'Minimal',
        description: 'Clean, simple backgrounds',
        searchTerms: ['abstract', 'minimal', 'white background', 'geometric'],
        musicMood: 'calm',
        filter: 'desaturated'
    }
};

// Niche-specific prompts for AI expansion
const NICHE_PROMPTS = {
    stoicism: {
        style: 'philosophical and contemplative, referencing ancient Stoic wisdom',
        tone: 'calm, wise, measured',
        visualStyle: 'dark_mode',
        examples: ['Marcus Aurelius', 'Seneca', 'Epictetus']
    },
    hustle: {
        style: 'energetic and motivating, focused on success and grinding',
        tone: 'intense, powerful, urgent',
        visualStyle: 'urban',
        examples: ['entrepreneurs', 'athletes', 'success stories']
    },
    affirmation: {
        style: 'warm and nurturing, focused on self-love and positivity',
        tone: 'gentle, loving, supportive',
        visualStyle: 'sunrise',
        examples: ['self-care', 'morning routine', 'gratitude']
    },
    psychology: {
        style: 'educational and insightful, backed by science',
        tone: 'informative, curious, enlightening',
        visualStyle: 'minimal',
        examples: ['brain facts', 'cognitive biases', 'mental health']
    },
    story: {
        style: 'narrative and engaging, using parables and moral stories',
        tone: 'storytelling, dramatic, meaningful',
        visualStyle: 'nature',
        examples: ['fables', 'life lessons', 'ancient wisdom']
    }
};

// Get hooks by category
app.get('/api/motivational/hooks', (req, res) => {
    res.json({
        success: true,
        hooks: HOOK_LIBRARY,
        categories: Object.keys(HOOK_LIBRARY)
    });
});

// Get visual style presets
app.get('/api/motivational/styles', (req, res) => {
    res.json({
        success: true,
        styles: VISUAL_STYLE_PRESETS
    });
});

// Get niche configurations
app.get('/api/motivational/niches', (req, res) => {
    res.json({
        success: true,
        niches: Object.keys(NICHE_PROMPTS).map(key => ({
            key,
            ...NICHE_PROMPTS[key]
        }))
    });
});

// Fetch quote from external APIs
app.get('/api/motivational/quote/:source', async (req, res) => {
    const { source } = req.params;

    console.log(`🧘 Motivational: Fetching quote from ${source}`);

    try {
        let quote = null;
        let author = null;

        switch (source) {
            case 'zen':
            case 'zenquotes':
                // ZenQuotes API - free, no key needed
                const zenResponse = await fetch('https://zenquotes.io/api/random');
                const zenData = await zenResponse.json();
                if (zenData && zenData[0]) {
                    quote = zenData[0].q;
                    author = zenData[0].a;
                }
                break;

            case 'stoic':
            case 'stoicism':
                // Stoic Quotes API
                const stoicResponse = await fetch('https://stoic-quotes.com/api/quote');
                const stoicData = await stoicResponse.json();
                if (stoicData) {
                    quote = stoicData.text;
                    author = stoicData.author;
                }
                break;

            case 'affirmation':
            case 'affirmations':
                // Affirmations.dev API
                const affirmResponse = await fetch('https://www.affirmations.dev/');
                const affirmData = await affirmResponse.json();
                if (affirmData) {
                    quote = affirmData.affirmation;
                    author = 'Daily Affirmation';
                }
                break;

            default:
                return res.status(400).json({ error: `Unknown source: ${source}` });
        }

        if (!quote) {
            throw new Error('No quote received from API');
        }

        console.log(`🧘 Motivational: Got quote: "${quote.substring(0, 50)}..."`);

        res.json({
            success: true,
            quote,
            author,
            source
        });

    } catch (error) {
        console.error(`Quote fetch error (${source}):`, error);
        res.status(500).json({
            error: 'Failed to fetch quote',
            details: error.message
        });
    }
});

// Expand quote into full script using AI
app.post('/api/motivational/expand-script', async (req, res) => {
    const { quote, author, niche, hookStyle, customHook } = req.body;

    if (!quote) {
        return res.status(400).json({ error: 'Quote is required' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'OpenRouter API key not configured' });
    }

    const nicheConfig = NICHE_PROMPTS[niche] || NICHE_PROMPTS.stoicism;
    const selectedHook = customHook || (HOOK_LIBRARY[hookStyle] ? HOOK_LIBRARY[hookStyle][0] : HOOK_LIBRARY.wisdom[0]);

    console.log(`🧘 Motivational: Expanding quote for niche "${niche}"`);

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-Title': 'Motivational Script Generator'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-001',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert motivational content creator for short-form video (TikTok, Reels, Shorts).
Your style is ${nicheConfig.style}.
Your tone is ${nicheConfig.tone}.
Create viral scripts that are impactful in under 30 seconds spoken time.`
                    },
                    {
                        role: 'user',
                        content: `Expand this quote into a viral short-form video script:

Quote: "${quote}"
Author: ${author || 'Unknown'}

Use this hook style as inspiration: "${selectedHook}"

Return a JSON object with:
- hook: A powerful opening line (1-2 sentences, based on the hook style)
- quote: The original quote (formatted nicely)
- author: The author name
- explanation: A compelling 2-3 sentence explanation that connects the quote to modern life
- cta: A call-to-action for engagement (e.g., "Follow for more", "Save this for later")
- visualCues: Array of 4 visual/B-roll suggestions that match the content
- hashtags: Array of 5 relevant viral hashtags
- estimatedDuration: Estimated spoken duration in seconds

Return ONLY valid JSON, no markdown.`
                    }
                ],
                temperature: 0.8,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('No content in AI response');
        }

        // Parse JSON from response
        let script;
        try {
            // Try to extract JSON if wrapped in markdown
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                content.match(/```\s*([\s\S]*?)\s*```/);
            const jsonStr = jsonMatch ? jsonMatch[1] : content;
            script = JSON.parse(jsonStr.trim());
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            // Return a structured fallback
            script = {
                hook: selectedHook,
                quote: quote,
                author: author || 'Unknown',
                explanation: 'This timeless wisdom reminds us of what truly matters in life.',
                cta: 'Follow for daily wisdom 🙏',
                visualCues: ['person contemplating', 'sunrise timelapse', 'nature scenery', 'inspirational text'],
                hashtags: ['#motivation', '#wisdom', '#mindset', '#inspiration', '#shorts'],
                estimatedDuration: 25
            };
        }

        console.log(`🧘 Motivational: Script generated (${script.estimatedDuration || 25}s)`);

        res.json({
            success: true,
            script,
            niche,
            visualStyle: nicheConfig.visualStyle
        });

    } catch (error) {
        console.error('Script expansion error:', error);
        res.status(500).json({
            error: 'Failed to expand script',
            details: error.message
        });
    }
});

// Generate voiceover using Edge TTS (free, no API key)
app.post('/api/motivational/generate-voice', async (req, res) => {
    const { text, voice, speed } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }

    // Voice options for Edge TTS
    const voiceMap = {
        'male-us': 'en-US-GuyNeural',
        'female-us': 'en-US-JennyNeural',
        'male-uk': 'en-GB-RyanNeural',
        'female-uk': 'en-GB-SoniaNeural',
        'male-au': 'en-AU-WilliamNeural',
        'female-au': 'en-AU-NatashaNeural',
        'male-deep': 'en-US-ChristopherNeural',
        'female-warm': 'en-US-AriaNeural'
    };

    const selectedVoice = voiceMap[voice] || voiceMap['male-deep'];
    const speedRate = speed || '+0%'; // e.g., '+10%', '-10%'

    const timestamp = Date.now();
    const outputFilename = `voice_${timestamp}.mp3`;
    const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

    console.log(`🎙️ Motivational: Generating voice with ${selectedVoice}`);

    try {
        // Use edge-tts Python package
        const args = [
            '-m', 'edge_tts',
            '--voice', selectedVoice,
            '--rate', speedRate,
            '--text', text,
            '--write-media', outputPath
        ];

        await new Promise((resolve, reject) => {
            const python = spawn('python3', args);
            let stderr = '';

            python.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`edge-tts: ${data}`);
            });

            python.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Edge TTS failed: ${stderr}`));
                } else {
                    resolve();
                }
            });

            python.on('error', (err) => {
                reject(new Error(`Failed to start edge-tts: ${err.message}. Install with: pip install edge-tts`));
            });
        });

        // Check if file was created
        if (!fs.existsSync(outputPath)) {
            throw new Error('Audio file was not created');
        }

        const stats = fs.statSync(outputPath);

        console.log(`🎙️ Motivational: Voice generated (${stats.size} bytes)`);

        res.json({
            success: true,
            audioPath: `/api/videos/file/${outputFilename}`,
            filename: outputFilename,
            size: stats.size,
            voice: selectedVoice
        });

    } catch (error) {
        console.error('Voice generation error:', error);
        res.status(500).json({
            error: 'Failed to generate voice',
            details: error.message
        });
    }
});

// Get available TTS voices
app.get('/api/motivational/voices', (req, res) => {
    res.json({
        success: true,
        voices: [
            { key: 'male-deep', name: 'Christopher (Deep Male)', description: 'Deep, authoritative voice' },
            { key: 'female-warm', name: 'Aria (Warm Female)', description: 'Warm, engaging voice' },
            { key: 'male-us', name: 'Guy (US Male)', description: 'Natural US male voice' },
            { key: 'female-us', name: 'Jenny (US Female)', description: 'Clear US female voice' },
            { key: 'male-uk', name: 'Ryan (UK Male)', description: 'British male voice' },
            { key: 'female-uk', name: 'Sonia (UK Female)', description: 'British female voice' },
            { key: 'male-au', name: 'William (AU Male)', description: 'Australian male voice' },
            { key: 'female-au', name: 'Natasha (AU Female)', description: 'Australian female voice' }
        ]
    });
});

// Download YouTube video as B-Roll with time selection
app.post('/api/motivational/download-broll', async (req, res) => {
    const { url, startTime, endTime, cropVertical } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'YouTube URL is required' });
    }

    // Default to 30 second clip if no times specified
    const start = startTime || '0:00';
    const end = endTime || '0:30';

    const timestamp = Date.now();
    const tempFilename = `broll_temp_${timestamp}.mp4`;
    const outputFilename = `broll_${timestamp}.mp4`;
    const tempPath = path.join(DOWNLOADS_DIR, tempFilename);
    const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

    console.log(`🎬 Motivational B-Roll: Downloading from ${url} (${start} - ${end})`);

    try {
        // Step 1: Download video segment using yt-dlp
        await new Promise((resolve, reject) => {
            const args = [
                '-f', 'bestvideo[height<=1080][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]',
                '--merge-output-format', 'mp4',
                '--download-sections', `*${start}-${end}`,
                '-o', tempPath,
                '--no-playlist',
                url
            ];

            console.log(`yt-dlp ${args.join(' ')}`);

            const ytdlp = spawn('yt-dlp', args);
            let stderr = '';

            ytdlp.stdout.on('data', (data) => {
                console.log(`yt-dlp: ${data}`);
            });

            ytdlp.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`yt-dlp stderr: ${data}`);
            });

            ytdlp.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`yt-dlp failed: ${stderr}`));
                } else {
                    resolve();
                }
            });

            ytdlp.on('error', reject);
        });

        // Check if file was created
        if (!fs.existsSync(tempPath)) {
            throw new Error('Video file was not created');
        }

        console.log(`🎬 Motivational B-Roll: Downloaded, now cropping to vertical`);

        // Step 2: Crop to 9:16 vertical format (center crop)
        if (cropVertical !== false) {
            await new Promise((resolve, reject) => {
                // Center crop to 9:16 aspect ratio
                const ffmpegArgs = [
                    '-i', tempPath,
                    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-c:a', 'aac',
                    '-b:a', '192k',
                    '-y',
                    outputPath
                ];

                const ffmpeg = spawn('ffmpeg', ffmpegArgs);
                let stderr = '';

                ffmpeg.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                ffmpeg.on('close', (code) => {
                    // Clean up temp file
                    if (fs.existsSync(tempPath)) {
                        fs.unlinkSync(tempPath);
                    }

                    if (code !== 0) {
                        console.error('FFmpeg stderr:', stderr);
                        reject(new Error(`FFmpeg crop failed with code ${code}`));
                    } else {
                        resolve();
                    }
                });

                ffmpeg.on('error', reject);
            });
        } else {
            // Just rename temp to output
            fs.renameSync(tempPath, outputPath);
        }

        if (!fs.existsSync(outputPath)) {
            throw new Error('Cropped video was not created');
        }

        const stats = fs.statSync(outputPath);

        console.log(`🎬 Motivational B-Roll: Ready (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

        res.json({
            success: true,
            filename: outputFilename,
            videoPath: `/api/videos/file/${outputFilename}`,
            size: stats.size
        });

    } catch (error) {
        // Cleanup on error
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

        console.error('B-Roll download error:', error);
        res.status(500).json({
            error: 'Failed to download B-Roll',
            details: error.message
        });
    }
});

// Suggested B-Roll search queries based on visual style
app.get('/api/motivational/broll-suggestions', (req, res) => {
    const suggestions = {
        dark_mode: [
            { query: 'dark clouds timelapse', description: 'Dramatic storm clouds' },
            { query: 'night city lights', description: 'City at night' },
            { query: 'rain on window', description: 'Moody rain footage' },
            { query: 'lightning storm', description: 'Epic thunder' }
        ],
        sunrise: [
            { query: 'sunrise timelapse', description: 'Beautiful sunrise' },
            { query: 'golden hour nature', description: 'Warm golden light' },
            { query: 'morning fog forest', description: 'Misty morning' },
            { query: 'ocean sunrise', description: 'Sunset over water' }
        ],
        nature: [
            { query: 'forest drone', description: 'Aerial forest shots' },
            { query: 'waterfall slow motion', description: 'Majestic waterfall' },
            { query: 'mountain landscape', description: 'Epic mountains' },
            { query: 'ocean waves', description: 'Peaceful waves' }
        ],
        urban: [
            { query: 'city timelapse', description: 'Busy city life' },
            { query: 'traffic lights night', description: 'Urban energy' },
            { query: 'skyscraper glass', description: 'Modern architecture' },
            { query: 'people walking city', description: 'Hustle culture' }
        ],
        minimal: [
            { query: 'abstract particles', description: 'Floating particles' },
            { query: 'geometric animation', description: 'Clean graphics' },
            { query: 'smoke black background', description: 'Minimalist smoke' },
            { query: 'water droplets macro', description: 'Artistic water' }
        ]
    };

    res.json({
        success: true,
        suggestions
    });
});

// ============================================
// AI YouTube B-Roll Generator
// Uses Gemini to suggest YouTube clips based on script
// ============================================

const GEMINI_API_KEYS = [
    process.env.GEMINI_API_KEY_1 || '',  // Primary
    process.env.GEMINI_API_KEY_2 || ''   // Fallback
];
let currentGeminiKeyIndex = 0;

// Get current API key, rotate on failure
function getGeminiApiKey() {
    return GEMINI_API_KEYS[currentGeminiKeyIndex];
}

function rotateGeminiApiKey() {
    currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % GEMINI_API_KEYS.length;
    console.log(`🔑 Rotated to Gemini API key ${currentGeminiKeyIndex + 1}`);
    return GEMINI_API_KEYS[currentGeminiKeyIndex];
}

// Hook up the forward-declared functions for callGeminiForNews
getGeminiApiKeyFn = getGeminiApiKey;
rotateGeminiApiKeyFn = rotateGeminiApiKey;

// Step 1: Get AI-suggested YouTube clips for the script
app.post('/api/motivational/ai-youtube-suggest', async (req, res) => {
    const { quote, script, niche } = req.body;

    if (!quote && !script) {
        return res.status(400).json({ error: 'Quote or script is required' });
    }

    console.log(`🎬 AI YouTube: Analyzing script for B-Roll suggestions...`);

    // Build the full script text
    const fullScript = script
        ? `Hook: ${script.hook || ''}\nQuote: ${script.quote || ''}\nExplanation: ${script.explanation || ''}\nCTA: ${script.cta || ''}`
        : quote;


    // Estimate script duration (approx 150 words per minute / 2.5 words per second)
    const wordCount = fullScript.split(/\s+/).length;
    const estimatedDuration = Math.max(5, Math.ceil(wordCount / 2.5));

    const prompt = `Suggest YouTube videos as B-Roll for this script (~${estimatedDuration} seconds):

${fullScript}

Prefer stock footage style videos - cinematic visuals like nature shots, cityscapes, abstract motion, aerial footage, etc. that work well as background B-roll.

Respond in JSON:
{
    "clips": [
        {
            "segment": "matching script text",
            "videoTitle": "video title",
            "channelName": "channel name",
            "startTime": "0:00",
            "endTime": "0:05",
            "duration": 5
        }
    ],
    "totalDuration": ${estimatedDuration}
}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${getGeminiApiKey()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 4096
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Gemini API error');
        }

        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log('   Raw Gemini response:', text.substring(0, 500));

        // Extract JSON from response (handle markdown code blocks)
        // Remove markdown code blocks if present
        text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

        // Try to find JSON object
        let jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('No JSON found in response:', text);
            throw new Error('Failed to find JSON in AI response');
        }

        let jsonStr = jsonMatch[0];

        // Clean up common JSON issues from AI
        // Remove trailing commas before closing braces/brackets
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

        let suggestions;
        try {
            suggestions = JSON.parse(jsonStr);
        } catch (parseError) {
            console.error('JSON parse error:', parseError.message);
            console.error('Attempted to parse:', jsonStr.substring(0, 500));
            throw new Error(`Failed to parse AI response: ${parseError.message}`);
        }

        console.log(`🎬 AI YouTube: Got ${suggestions.clips?.length || 0} clip suggestions`);

        res.json({
            success: true,
            suggestions,
            rawResponse: text
        });

    } catch (error) {
        console.error('AI YouTube suggestion error:', error);

        // Rotate API key on quota exceeded error
        if (error.message?.includes('quota') || error.message?.includes('Quota')) {
            rotateGeminiApiKey();
        }

        res.status(500).json({
            error: 'Failed to get AI suggestions',
            details: error.message
        });
    }
});

// Step 1.5: Resolve YouTube URLs without downloading (for preview)
app.post('/api/motivational/ai-youtube-resolve', async (req, res) => {
    const { clips } = req.body;

    if (!clips || !Array.isArray(clips) || clips.length === 0) {
        return res.status(400).json({ error: 'Clips array is required' });
    }

    console.log(`🔍 AI YouTube: Resolving ${clips.length} clip URLs...`);

    const resolvedClips = [];

    for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];

        // Build search query from video title and channel name
        const searchQuery = clip.videoTitle && clip.channelName
            ? `${clip.videoTitle} ${clip.channelName}`
            : clip.searchQuery || clip.videoTitle;

        console.log(`   [${i + 1}/${clips.length}] Resolving: "${searchQuery}"`);

        try {
            // Use yt-dlp to get video info without downloading
            const result = await new Promise((resolve, reject) => {
                const args = [
                    `ytsearch1:${searchQuery}`,
                    '--get-id',
                    '--get-title',
                    '--get-thumbnail',
                    '--no-download',
                    '--no-playlist'
                ];

                const ytdlp = spawn('yt-dlp', args);
                let stdout = '';
                let stderr = '';

                ytdlp.stdout.on('data', (data) => { stdout += data.toString(); });
                ytdlp.stderr.on('data', (data) => { stderr += data.toString(); });

                ytdlp.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`yt-dlp failed: ${stderr}`));
                    } else {
                        const lines = stdout.trim().split('\n').filter(l => l.trim());
                        console.log(`   yt-dlp output lines:`, lines);

                        // YouTube video IDs are exactly 11 characters (alphanumeric, _, -)
                        const videoIdPattern = /^[a-zA-Z0-9_-]{11}$/;
                        let videoId = '';
                        let actualTitle = '';
                        let thumbnailUrl = '';

                        for (const line of lines) {
                            if (videoIdPattern.test(line)) {
                                videoId = line;
                            } else if (line.startsWith('http')) {
                                thumbnailUrl = line;
                            } else if (!actualTitle) {
                                actualTitle = line;
                            }
                        }

                        resolve({ videoId, actualTitle, thumbnailUrl });
                    }
                });

                ytdlp.on('error', reject);
            });

            // Convert startTime to seconds for YouTube URL
            const startSeconds = timeToSeconds(clip.startTime || '0:00');

            resolvedClips.push({
                ...clip,
                index: i,
                videoId: result.videoId,
                actualTitle: result.actualTitle,
                thumbnailUrl: result.thumbnailUrl,
                youtubeUrl: `https://www.youtube.com/watch?v=${result.videoId}&t=${startSeconds}s`,
                resolved: true
            });

            console.log(`   ✓ Resolved: ${result.actualTitle}`);

        } catch (err) {
            console.error(`   ✗ Failed to resolve clip ${i + 1}:`, err.message);
            resolvedClips.push({
                ...clip,
                index: i,
                resolved: false,
                error: err.message
            });
        }
    }

    console.log(`🔍 AI YouTube: Resolved ${resolvedClips.filter(c => c.resolved).length}/${clips.length} clips`);

    res.json({
        success: true,
        resolvedClips
    });
});

// Helper: Convert time string to seconds (e.g., "1:30" -> 90)
function timeToSeconds(timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
}

// Step 1.6: Get alternative clip suggestion from Gemini
app.post('/api/motivational/ai-youtube-alternative', async (req, res) => {
    const { segment, currentSuggestion, duration } = req.body;

    if (!segment) {
        return res.status(400).json({ error: 'Segment text is required' });
    }

    console.log(`🔄 AI YouTube: Getting alternative for segment...`);

    const prompt = `Suggest ONE YouTube video as B-Roll for this script segment (~${duration || 5} seconds):

"${segment}"

${currentSuggestion ? `Previous suggestion was "${currentSuggestion}" - suggest something different.` : ''}

Prefer stock footage style - cinematic visuals that work as background B-roll.

Respond ONLY with JSON:
{
    "videoTitle": "video title",
    "channelName": "channel name",
    "startTime": "0:00",
    "endTime": "0:05",
    "duration": ${duration || 5}
}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${getGeminiApiKey()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 2048
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Gemini API error');
        }

        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('   Alternative raw response:', text.substring(0, 300));

        // Clean up markdown code blocks
        text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('   No JSON found in:', text);
            throw new Error('Failed to find JSON in AI response');
        }

        let jsonStr = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1');
        let alternative;
        try {
            alternative = JSON.parse(jsonStr);
        } catch (parseErr) {
            console.error('   JSON parse error:', jsonStr.substring(0, 200));
            throw new Error('Failed to parse JSON');
        }
        alternative.segment = segment;

        // Now resolve the URL for this alternative
        const searchQuery = `${alternative.videoTitle} ${alternative.channelName}`;

        const resolveResult = await new Promise((resolve, reject) => {
            const args = [
                `ytsearch1:${searchQuery}`,
                '--get-id',
                '--get-title',
                '--get-thumbnail',
                '--no-download',
                '--no-playlist'
            ];

            const ytdlp = spawn('yt-dlp', args);
            let stdout = '';
            let stderr = '';

            ytdlp.stdout.on('data', (data) => { stdout += data.toString(); });
            ytdlp.stderr.on('data', (data) => { stderr += data.toString(); });

            ytdlp.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`yt-dlp failed`));
                } else {
                    const lines = stdout.trim().split('\n').filter(l => l.trim());

                    // YouTube video IDs are exactly 11 characters
                    const videoIdPattern = /^[a-zA-Z0-9_-]{11}$/;
                    let videoId = '';
                    let actualTitle = '';
                    let thumbnailUrl = '';

                    for (const line of lines) {
                        if (videoIdPattern.test(line)) {
                            videoId = line;
                        } else if (line.startsWith('http')) {
                            thumbnailUrl = line;
                        } else if (!actualTitle) {
                            actualTitle = line;
                        }
                    }

                    resolve({ videoId, actualTitle, thumbnailUrl });
                }
            });

            ytdlp.on('error', reject);
        });

        const startSeconds = timeToSeconds(alternative.startTime || '0:00');

        res.json({
            success: true,
            alternative: {
                ...alternative,
                videoId: resolveResult.videoId,
                actualTitle: resolveResult.actualTitle,
                thumbnailUrl: resolveResult.thumbnailUrl,
                youtubeUrl: `https://www.youtube.com/watch?v=${resolveResult.videoId}&t=${startSeconds}s`,
                resolved: true
            }
        });

    } catch (error) {
        console.error('AI YouTube alternative error:', error);
        res.status(500).json({
            error: 'Failed to get alternative',
            details: error.message
        });
    }
});

// Step 2: Search and download YouTube clips based on AI suggestions
app.post('/api/motivational/ai-youtube-download', async (req, res) => {
    const { clips } = req.body;

    if (!clips || !Array.isArray(clips) || clips.length === 0) {
        return res.status(400).json({ error: 'Clips array is required' });
    }

    console.log(`🎬 AI YouTube: Downloading ${clips.length} clips...`);

    const timestamp = Date.now();
    const downloadedClips = [];
    const errors = [];

    for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const clipFilename = `aiclip_${timestamp}_${i}.mp4`;
        const clipPath = path.join(DOWNLOADS_DIR, clipFilename);

        // Build search query from video title and channel name for accurate matching
        const searchQuery = clip.videoTitle && clip.channelName
            ? `${clip.videoTitle} ${clip.channelName}`
            : clip.searchQuery || clip.videoTitle;

        console.log(`   [${i + 1}/${clips.length}] Searching: "${searchQuery}"`);

        try {
            // Search YouTube for the video and download specific segment
            await new Promise((resolve, reject) => {
                const args = [
                    `ytsearch1:${searchQuery}`,  // Search using title + channel for accuracy
                    '-f', 'bestvideo[height<=1080][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]',
                    '--merge-output-format', 'mp4',
                    '--download-sections', `*${clip.startTime}-${clip.endTime}`,
                    '-o', clipPath,
                    '--no-playlist',
                    '--quiet'
                ];

                const ytdlp = spawn('yt-dlp', args);
                let stderr = '';

                ytdlp.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                ytdlp.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`yt-dlp failed: ${stderr}`));
                    } else {
                        resolve();
                    }
                });

                ytdlp.on('error', reject);
            });

            // Crop to vertical 9:16
            const croppedFilename = `aiclip_cropped_${timestamp}_${i}.mp4`;
            const croppedPath = path.join(DOWNLOADS_DIR, croppedFilename);

            await new Promise((resolve, reject) => {
                const ffmpegArgs = [
                    '-i', clipPath,
                    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-an',  // No audio for B-Roll
                    '-y',
                    croppedPath
                ];

                const ffmpeg = spawn('ffmpeg', ffmpegArgs);
                let stderr = '';

                ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });

                ffmpeg.on('close', (code) => {
                    // Remove original
                    if (fs.existsSync(clipPath)) fs.unlinkSync(clipPath);

                    if (code !== 0) {
                        reject(new Error(`Crop failed`));
                    } else {
                        resolve();
                    }
                });

                ffmpeg.on('error', reject);
            });

            if (fs.existsSync(croppedPath)) {
                downloadedClips.push({
                    index: i,
                    filename: croppedFilename,
                    segment: clip.segment,
                    duration: clip.duration,
                    path: `/api/videos/file/${croppedFilename}`
                });
                console.log(`   ✓ Downloaded and cropped clip ${i + 1}`);
            }

        } catch (err) {
            console.error(`   ✗ Failed clip ${i + 1}:`, err.message);
            errors.push({ index: i, segment: clip.segment, error: err.message });
        }
    }

    console.log(`🎬 AI YouTube: Downloaded ${downloadedClips.length}/${clips.length} clips`);

    res.json({
        success: true,
        downloadedClips,
        errors,
        totalDownloaded: downloadedClips.length
    });
});

// Step 3: Merge all AI clips into final video with captions
app.post('/api/motivational/ai-youtube-assemble', async (req, res) => {
    const { clips, audioFilename, script, captionStyle } = req.body;

    if (!clips || clips.length === 0) {
        return res.status(400).json({ error: 'Clips array is required' });
    }

    if (!audioFilename) {
        return res.status(400).json({ error: 'Audio filename is required' });
    }

    const audioPath = path.join(DOWNLOADS_DIR, audioFilename);
    if (!fs.existsSync(audioPath)) {
        return res.status(404).json({ error: 'Audio file not found' });
    }

    console.log(`🎬 AI YouTube: Assembling ${clips.length} clips with audio...`);

    const timestamp = Date.now();
    const concatListPath = path.join(DOWNLOADS_DIR, `concat_${timestamp}.txt`);
    const mergedVideoPath = path.join(DOWNLOADS_DIR, `merged_${timestamp}.mp4`);
    const outputFilename = `ai_motivational_${timestamp}.mp4`;
    const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

    try {
        // Step 1: Create concat list for FFmpeg
        const concatContent = clips.map(c => `file '${path.join(DOWNLOADS_DIR, c.filename)}'`).join('\n');
        fs.writeFileSync(concatListPath, concatContent);

        // Step 2: Concatenate all video clips
        console.log(`   Concatenating ${clips.length} clips...`);
        await new Promise((resolve, reject) => {
            const args = [
                '-f', 'concat',
                '-safe', '0',
                '-i', concatListPath,
                '-c', 'copy',
                '-y',
                mergedVideoPath
            ];

            const ffmpeg = spawn('ffmpeg', args);
            let stderr = '';
            ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });
            ffmpeg.on('close', (code) => {
                if (code !== 0) {
                    console.error('Concat error:', stderr);
                    reject(new Error('Failed to concatenate clips'));
                } else {
                    resolve();
                }
            });
            ffmpeg.on('error', reject);
        });

        // Step 3: Add audio to merged video (no looping - clips play sequentially once)
        console.log(`   Adding audio to video...`);
        const tempWithAudio = path.join(DOWNLOADS_DIR, `temp_audio_${timestamp}.mp4`);

        await new Promise((resolve, reject) => {
            const args = [
                '-i', mergedVideoPath,
                '-i', audioPath,
                '-map', '0:v',
                '-map', '1:a',
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-shortest',
                '-y',
                tempWithAudio
            ];

            const ffmpeg = spawn('ffmpeg', args);
            let stderr = '';
            ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });
            ffmpeg.on('close', (code) => {
                // Cleanup
                if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
                if (fs.existsSync(mergedVideoPath)) fs.unlinkSync(mergedVideoPath);

                if (code !== 0) {
                    console.error('Audio merge error:', stderr);
                    reject(new Error('Failed to add audio'));
                } else {
                    resolve();
                }
            });
            ffmpeg.on('error', reject);
        });

        // Step 4: Add captions using Whisper (reuse existing logic)
        if (script) {
            console.log(`   Transcribing and adding captions...`);

            const style = MOTIVATIONAL_CAPTION_STYLES[captionStyle] || MOTIVATIONAL_CAPTION_STYLES.viral;
            const assPath = path.join(DOWNLOADS_DIR, `captions_ai_${timestamp}.ass`);

            // Use Whisper for word-level timestamps
            let whisperWords = [];
            try {
                whisperWords = await new Promise((resolve, reject) => {
                    const whisperArgs = [
                        '-c',
                        `import whisper; import json; ` +
                        `model = whisper.load_model('base'); ` +
                        `result = model.transcribe('${audioPath}', word_timestamps=True); ` +
                        `words = [{'word': w['word'].strip(), 'start': round(w['start'], 3), 'end': round(w['end'], 3)} for s in result.get('segments', []) for w in s.get('words', [])]; ` +
                        `print(json.dumps(words))`
                    ];

                    const python = spawn('python3', whisperArgs);
                    let stdout = '';
                    let stderr = '';

                    python.stdout.on('data', (data) => { stdout += data.toString(); });
                    python.stderr.on('data', (data) => { stderr += data.toString(); });

                    python.on('close', (code) => {
                        if (code !== 0) {
                            resolve([]);
                        } else {
                            try {
                                resolve(JSON.parse(stdout.trim()));
                            } catch (e) {
                                resolve([]);
                            }
                        }
                    });
                    python.on('error', () => resolve([]));
                });
            } catch (err) {
                whisperWords = [];
            }

            // Generate ASS subtitles
            const assHeader = `[Script Info]
Title: AI Motivational Captions
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,${style.fontFamily},${style.fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,5,50,50,400,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

            let assEvents = '';

            if (whisperWords.length > 0) {
                const phraseSize = 4;
                const phrases = [];

                for (let i = 0; i < whisperWords.length; i += phraseSize) {
                    const phraseWords = whisperWords.slice(i, i + phraseSize);
                    if (phraseWords.length > 0) {
                        phrases.push({
                            text: phraseWords.map(w => w.word).join(' '),
                            start: phraseWords[0].start,
                            end: phraseWords[phraseWords.length - 1].end
                        });
                    }
                }

                phrases.forEach((phrase) => {
                    const startStr = formatASSTime(phrase.start);
                    const endStr = formatASSTime(phrase.end);

                    const highlightedPhrase = phrase.text.split(' ').map(word => {
                        if (word.length > 5) {
                            return `{\\c&H00FFFF&\\b1}${word.toUpperCase()}{\\c&HFFFFFF&\\b0}`;
                        }
                        return word.toUpperCase();
                    }).join(' ');

                    const effectText = `{\\fad(80,80)\\t(0,80,\\fscx105\\fscy105)\\t(80,160,\\fscx100\\fscy100)}${highlightedPhrase}`;
                    assEvents += `Dialogue: 0,${startStr},${endStr},Main,,0,0,0,,${effectText}\n`;
                });
            }

            const assContent = assHeader + assEvents;
            fs.writeFileSync(assPath, assContent);

            // Burn subtitles
            await new Promise((resolve, reject) => {
                const args = [
                    '-i', tempWithAudio,
                    '-vf', `ass=${assPath}`,
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-c:a', 'copy',
                    '-y',
                    outputPath
                ];

                const ffmpeg = spawn('ffmpeg', args);
                let stderr = '';
                ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });
                ffmpeg.on('close', (code) => {
                    // Cleanup
                    if (fs.existsSync(tempWithAudio)) fs.unlinkSync(tempWithAudio);
                    if (fs.existsSync(assPath)) fs.unlinkSync(assPath);

                    if (code !== 0) {
                        console.error('Caption burn error:', stderr);
                        reject(new Error('Failed to burn captions'));
                    } else {
                        resolve();
                    }
                });
                ffmpeg.on('error', reject);
            });
        } else {
            // No captions, just rename
            fs.renameSync(tempWithAudio, outputPath);
        }

        // Cleanup individual clips
        clips.forEach(c => {
            const clipPath = path.join(DOWNLOADS_DIR, c.filename);
            if (fs.existsSync(clipPath)) fs.unlinkSync(clipPath);
        });

        const stats = fs.statSync(outputPath);

        console.log(`🎬 AI YouTube: Video assembled (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

        res.json({
            success: true,
            videoPath: `/api/videos/file/${outputFilename}`,
            filename: outputFilename,
            size: stats.size
        });

    } catch (error) {
        // Cleanup on error
        [concatListPath, mergedVideoPath, outputPath].forEach(p => {
            if (fs.existsSync(p)) fs.unlinkSync(p);
        });

        console.error('AI YouTube assembly error:', error);
        res.status(500).json({
            error: 'Failed to assemble video',
            details: error.message
        });
    }
});

// Caption style presets for motivational content
const MOTIVATIONAL_CAPTION_STYLES = {
    viral: {
        fontFamily: 'Impact',
        fontSize: 80,
        primaryColor: 'white',
        highlightColor: 'yellow',
        shadowColor: 'black',
        position: 'center', // center of screen
        animation: 'pop'
    },
    minimal: {
        fontFamily: 'Arial',
        fontSize: 60,
        primaryColor: 'white',
        highlightColor: 'cyan',
        shadowColor: 'black',
        position: 'bottom',
        animation: 'fade'
    },
    bold: {
        fontFamily: 'Impact',
        fontSize: 90,
        primaryColor: 'white',
        highlightColor: '#FF6B35',
        shadowColor: 'black',
        position: 'center',
        animation: 'scale'
    },
    neon: {
        fontFamily: 'Arial Black',
        fontSize: 70,
        primaryColor: '#00FFFF',
        highlightColor: '#FF00FF',
        shadowColor: '#000080',
        position: 'center',
        animation: 'glow'
    }
};

// Get caption styles
app.get('/api/motivational/caption-styles', (req, res) => {
    res.json({
        success: true,
        styles: Object.keys(MOTIVATIONAL_CAPTION_STYLES).map(key => ({
            key,
            ...MOTIVATIONAL_CAPTION_STYLES[key]
        }))
    });
});

// Assemble motivational video with INSANE captions burned in
app.post('/api/motivational/assemble-video', async (req, res) => {
    const {
        audioFilename,
        backgroundVideoFilename,
        script,
        captionStyle,
        outputFormat
    } = req.body;

    if (!audioFilename) {
        return res.status(400).json({ error: 'Audio filename is required' });
    }

    const audioPath = path.join(DOWNLOADS_DIR, audioFilename);

    if (!fs.existsSync(audioPath)) {
        return res.status(404).json({ error: 'Audio file not found' });
    }

    const timestamp = Date.now();
    const tempVideoFilename = `temp_${timestamp}.mp4`;
    const outputFilename = `motivational_${timestamp}.mp4`;
    const srtFilename = `captions_${timestamp}.srt`;
    const assFilename = `captions_${timestamp}.ass`;
    const tempVideoPath = path.join(DOWNLOADS_DIR, tempVideoFilename);
    const outputPath = path.join(DOWNLOADS_DIR, outputFilename);
    const srtPath = path.join(DOWNLOADS_DIR, srtFilename);
    const assPath = path.join(DOWNLOADS_DIR, assFilename);

    console.log(`🎬 Motivational: Assembling video with INSANE captions`);

    try {
        // Step 1: Create base video (background + audio)
        let baseVideoArgs = [];

        if (backgroundVideoFilename) {
            const bgPath = path.join(DOWNLOADS_DIR, backgroundVideoFilename);
            if (!fs.existsSync(bgPath)) {
                return res.status(404).json({ error: 'Background video not found' });
            }

            baseVideoArgs = [
                '-stream_loop', '-1',
                '-i', bgPath,
                '-i', audioPath,
                '-filter_complex', '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v]',
                '-map', '[v]',
                '-map', '1:a',
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-shortest',
                '-y',
                tempVideoPath
            ];
        } else {
            baseVideoArgs = [
                '-f', 'lavfi',
                '-i', 'color=c=black:s=1080x1920:r=30',
                '-i', audioPath,
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-shortest',
                '-y',
                tempVideoPath
            ];
        }

        console.log(`🎬 Step 1: Creating base video...`);

        await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', baseVideoArgs);
            let stderr = '';
            ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });
            ffmpeg.on('close', (code) => {
                if (code !== 0) {
                    console.error('FFmpeg base video error:', stderr);
                    reject(new Error(`Base video creation failed`));
                } else {
                    resolve();
                }
            });
            ffmpeg.on('error', reject);
        });

        // Step 2: Transcribe audio with Whisper for word-level timestamps
        if (script) {
            console.log(`🎬 Step 2: Transcribing audio with Whisper for sync...`);

            const style = MOTIVATIONAL_CAPTION_STYLES[captionStyle] || MOTIVATIONAL_CAPTION_STYLES.viral;

            // Use Whisper to get word-level timestamps
            let whisperWords = [];
            try {
                whisperWords = await new Promise((resolve, reject) => {
                    const whisperArgs = [
                        '-c',
                        `import whisper; import json; ` +
                        `model = whisper.load_model('base'); ` +
                        `result = model.transcribe('${audioPath}', word_timestamps=True); ` +
                        `words = [{'word': w['word'].strip(), 'start': round(w['start'], 3), 'end': round(w['end'], 3)} for s in result.get('segments', []) for w in s.get('words', [])]; ` +
                        `print(json.dumps(words))`
                    ];

                    console.log(`   Running Whisper transcription...`);
                    const python = spawn('python3', whisperArgs);
                    let stdout = '';
                    let stderr = '';

                    python.stdout.on('data', (data) => { stdout += data.toString(); });
                    python.stderr.on('data', (data) => { stderr += data.toString(); });

                    python.on('close', (code) => {
                        if (code !== 0) {
                            console.error('Whisper error:', stderr);
                            resolve([]); // Fall back to even split
                        } else {
                            try {
                                const parsed = JSON.parse(stdout.trim());
                                console.log(`   Whisper found ${parsed.length} words with timestamps`);
                                resolve(parsed);
                            } catch (e) {
                                console.error('Failed to parse Whisper output:', e);
                                resolve([]);
                            }
                        }
                    });

                    python.on('error', () => {
                        console.error('Whisper not available');
                        resolve([]);
                    });
                });
            } catch (err) {
                console.error('Whisper transcription failed:', err);
                whisperWords = [];
            }

            console.log(`🎬 Step 3: Creating SYNCED captions...`);

            // Create ASS subtitle file with advanced styling
            const assHeader = `[Script Info]
Title: Motivational Captions
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,${style.fontFamily},${style.fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,5,50,50,400,1
Style: Highlight,${style.fontFamily},${style.fontSize + 10},&H0000FFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,110,110,0,0,1,5,3,5,50,50,400,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

            let assEvents = '';

            if (whisperWords.length > 0) {
                // Group words into phrases of 3-4 words each, using Whisper timestamps
                const phraseSize = 4;
                const phrases = [];

                for (let i = 0; i < whisperWords.length; i += phraseSize) {
                    const phraseWords = whisperWords.slice(i, i + phraseSize);
                    if (phraseWords.length > 0) {
                        phrases.push({
                            text: phraseWords.map(w => w.word).join(' '),
                            start: phraseWords[0].start,
                            end: phraseWords[phraseWords.length - 1].end
                        });
                    }
                }

                console.log(`   Created ${phrases.length} synced phrases`);

                phrases.forEach((phrase, idx) => {
                    const startStr = formatASSTime(phrase.start);
                    const endStr = formatASSTime(phrase.end);

                    // Highlight key words (longer words get highlighted)
                    const highlightedPhrase = phrase.text.split(' ').map(word => {
                        if (word.length > 5) {
                            return `{\\c&H00FFFF&\\b1}${word.toUpperCase()}{\\c&HFFFFFF&\\b0}`;
                        }
                        return word.toUpperCase();
                    }).join(' ');

                    // Add pop-in animation with fade
                    const effectText = `{\\fad(80,80)\\t(0,80,\\fscx105\\fscy105)\\t(80,160,\\fscx100\\fscy100)}${highlightedPhrase}`;

                    assEvents += `Dialogue: 0,${startStr},${endStr},Main,,0,0,0,,${effectText}\n`;
                });

            } else {
                // Fallback: Use script text with even timing if Whisper fails
                console.log(`   Whisper unavailable, using fallback timing...`);

                const fullText = `${script.hook || ''} ${script.quote || ''} ${script.explanation || ''} ${script.cta || ''}`.trim();
                const words = fullText.split(/\s+/).filter(w => w.length > 0);

                // Get audio duration for fallback
                const audioDuration = await new Promise((resolve) => {
                    const ffprobe = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioPath]);
                    let stdout = '';
                    ffprobe.stdout.on('data', (data) => { stdout += data.toString(); });
                    ffprobe.on('close', (code) => { resolve(code === 0 ? parseFloat(stdout.trim()) || 30 : 30); });
                    ffprobe.on('error', () => resolve(30));
                });

                const phraseSize = 4;
                const phrases = [];
                for (let i = 0; i < words.length; i += phraseSize) {
                    phrases.push(words.slice(i, i + phraseSize).join(' '));
                }

                const phraseDuration = audioDuration / phrases.length;

                phrases.forEach((phrase, idx) => {
                    const startTime = idx * phraseDuration;
                    const endTime = Math.min((idx + 1) * phraseDuration, audioDuration);

                    const startStr = formatASSTime(startTime);
                    const endStr = formatASSTime(endTime);

                    const highlightedPhrase = phrase.split(' ').map(word => {
                        if (word.length > 5) {
                            return `{\\c&H00FFFF&\\b1}${word.toUpperCase()}{\\c&HFFFFFF&\\b0}`;
                        }
                        return word.toUpperCase();
                    }).join(' ');

                    const effectText = `{\\fad(80,80)\\t(0,80,\\fscx105\\fscy105)\\t(80,160,\\fscx100\\fscy100)}${highlightedPhrase}`;

                    assEvents += `Dialogue: 0,${startStr},${endStr},Main,,0,0,0,,${effectText}\n`;
                });
            }

            const assContent = assHeader + assEvents;
            fs.writeFileSync(assPath, assContent);

            console.log(`🎬 Step 3: Burning captions into video...`);

            // Step 3: Burn subtitles into video
            const burnArgs = [
                '-i', tempVideoPath,
                '-vf', `ass=${assPath}`,
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-c:a', 'copy',
                '-y',
                outputPath
            ];

            await new Promise((resolve, reject) => {
                const ffmpeg = spawn('ffmpeg', burnArgs);
                let stderr = '';
                ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });
                ffmpeg.on('close', (code) => {
                    // Cleanup temp files
                    if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
                    if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
                    if (fs.existsSync(srtPath)) fs.unlinkSync(srtPath);

                    if (code !== 0) {
                        console.error('FFmpeg burn captions error:', stderr);
                        // Try without ASS as fallback
                        reject(new Error(`Caption burn failed`));
                    } else {
                        resolve();
                    }
                });
                ffmpeg.on('error', reject);
            });

        } else {
            // No script, just rename temp to output
            fs.renameSync(tempVideoPath, outputPath);
        }

        if (!fs.existsSync(outputPath)) {
            throw new Error('Output video was not created');
        }

        const stats = fs.statSync(outputPath);

        console.log(`🎬 Motivational: Video assembled with captions (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

        res.json({
            success: true,
            videoPath: `/api/videos/file/${outputFilename}`,
            filename: outputFilename,
            size: stats.size
        });

    } catch (error) {
        // Cleanup on error
        [tempVideoPath, outputPath, srtPath, assPath].forEach(p => {
            if (fs.existsSync(p)) fs.unlinkSync(p);
        });

        console.error('Video assembly error:', error);
        res.status(500).json({
            error: 'Failed to assemble video',
            details: error.message
        });
    }
});

// Helper function to format time for ASS subtitles
function formatASSTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const centisecs = Math.floor((seconds % 1) * 100);
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centisecs).padStart(2, '0')}`;
}

// Generate AI quote (original, not from API)
app.post('/api/motivational/generate-quote', async (req, res) => {
    const { niche, theme } = req.body;

    const nicheConfig = NICHE_PROMPTS[niche] || NICHE_PROMPTS.stoicism;

    console.log(`🧘 Motivational: Generating AI quote for niche "${niche}"`);

    const prompt = `Share a REAL, famous quote that's perfect for motivational content creation.

Niche: ${niche}
Theme: ${theme || 'life wisdom'}
Style: ${nicheConfig.style}

Requirements:
- Must be a REAL quote from a famous philosopher, author, leader, or thinker
- Perfect for short-form video content (TikTok, Reels, Shorts)
- Powerful, memorable, and shareable
- Good examples: ${nicheConfig.examples.join(', ')}

Return ONLY a JSON object:
{
    "quote": "The actual famous quote",
    "author": "Real author's name",
    "theme": "The theme"
}

Return ONLY valid JSON, no other text.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${getGeminiApiKey()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 500
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Gemini API error');
        }

        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!content) {
            throw new Error('No content in AI response');
        }

        let result;
        try {
            // Clean up markdown code blocks
            let jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1');
            }
            result = JSON.parse(jsonStr);
        } catch (parseError) {
            result = {
                quote: content.trim(),
                author: 'AI Philosopher',
                theme: theme || 'wisdom'
            };
        }

        console.log(`🧘 Motivational: Generated quote: "${result.quote.substring(0, 50)}..."`);

        res.json({
            success: true,
            ...result,
            source: 'ai-generated'
        });

    } catch (error) {
        console.error('Quote generation error:', error);
        res.status(500).json({
            error: 'Failed to generate quote',
            details: error.message
        });
    }
});

// Batch generate multiple scripts
app.post('/api/motivational/batch-generate', async (req, res) => {
    const { quotes, niche, hookStyle } = req.body;

    if (!quotes || !Array.isArray(quotes) || quotes.length === 0) {
        return res.status(400).json({ error: 'Quotes array is required' });
    }

    if (quotes.length > 5) {
        return res.status(400).json({ error: 'Maximum 5 quotes per batch' });
    }

    console.log(`🧘 Motivational: Batch generating ${quotes.length} scripts`);

    const results = [];
    const errors = [];

    for (let i = 0; i < quotes.length; i++) {
        const { quote, author } = quotes[i];

        try {
            // Make internal request to expand-script endpoint
            const response = await fetch(`http://localhost:${PORT}/api/motivational/expand-script`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quote, author, niche, hookStyle })
            });

            const data = await response.json();

            if (data.success) {
                results.push({
                    index: i,
                    ...data
                });
            } else {
                errors.push({ index: i, error: data.error });
            }
        } catch (error) {
            errors.push({ index: i, error: error.message });
        }

        // Small delay to avoid rate limiting
        if (i < quotes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.log(`🧘 Motivational: Batch complete - ${results.length} success, ${errors.length} errors`);

    res.json({
        success: true,
        results,
        errors,
        total: quotes.length
    });
});

// ============================================
// SPORTS ENDPOINTS - Music Sync Feature
// ============================================

// Analyze music with Gemini to find best section for short content
app.post('/api/sports/analyze-music', async (req, res) => {
    const { musicUrl, videoDuration = 30 } = req.body;

    if (!musicUrl) {
        return res.status(400).json({ error: 'Music URL is required' });
    }

    console.log(`🏆 Sports: Analyzing music from ${musicUrl}`);

    try {
        // First, get music metadata using yt-dlp
        const metadata = await new Promise((resolve, reject) => {
            const args = [
                '--dump-json',
                '--no-download',
                musicUrl
            ];

            const ytdlp = spawn('yt-dlp', args);
            let stdout = '';
            let stderr = '';

            ytdlp.stdout.on('data', (data) => { stdout += data.toString(); });
            ytdlp.stderr.on('data', (data) => { stderr += data.toString(); });

            ytdlp.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Failed to get music metadata: ${stderr}`));
                } else {
                    try {
                        resolve(JSON.parse(stdout));
                    } catch (e) {
                        reject(new Error('Failed to parse music metadata'));
                    }
                }
            });

            ytdlp.on('error', reject);
        });

        const musicTitle = metadata.title || 'Unknown';
        const musicDuration = metadata.duration || 180;
        const musicDescription = metadata.description || '';

        console.log(`🏆 Sports: Music "${musicTitle}" (${musicDuration}s)`);

        // Use Gemini to analyze and suggest best section
        const prompt = `You are a music editor for viral short-form sports content (TikTok, Reels, Shorts).

Analyze this music and suggest the BEST ${videoDuration}-second section for a sports highlight video.

Music Title: "${musicTitle}"
Total Duration: ${musicDuration} seconds
Description: ${musicDescription ? musicDescription.substring(0, 500) : 'Not available'}

Rules for selecting the best section:
1. Look for the CHORUS, DROP, or most energetic part of the song
2. For sports content, high-energy sections with beats work best
3. The section should have a satisfying start (not mid-word/phrase)
4. Consider common song structures:
   - Intro: 0-30s
   - Verse 1: 30-60s
   - Chorus 1: 60-90s (often THE best part!)
   - Verse 2: 90-120s
   - Chorus 2: 120-150s
   - Bridge/Drop: 150-180s
   - Outro: last 30s

Return ONLY valid JSON:
{
    "start": "M:SS",
    "end": "M:SS", 
    "startSeconds": <number>,
    "endSeconds": <number>,
    "reason": "Brief explanation of why this section is best"
}

The section must be exactly ${videoDuration} seconds long.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${getGeminiApiKey()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 300
                }
            })
        });

        const aiData = await response.json();

        if (!response.ok) {
            throw new Error(aiData.error?.message || 'Gemini API error');
        }

        const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

        let suggestion;
        try {
            let jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
            suggestion = JSON.parse(jsonStr);
        } catch (parseError) {
            // Fallback: use the most likely chorus section (around 1:00-1:30)
            const startSec = Math.min(60, Math.max(0, musicDuration - videoDuration));
            suggestion = {
                start: `${Math.floor(startSec / 60)}:${String(startSec % 60).padStart(2, '0')}`,
                end: `${Math.floor((startSec + videoDuration) / 60)}:${String((startSec + videoDuration) % 60).padStart(2, '0')}`,
                startSeconds: startSec,
                endSeconds: startSec + videoDuration,
                reason: 'Suggested chorus section (AI parsing failed, using default)'
            };
        }

        // Ensure endSeconds doesn't exceed music duration
        if (suggestion.endSeconds > musicDuration) {
            suggestion.startSeconds = Math.max(0, musicDuration - videoDuration);
            suggestion.endSeconds = musicDuration;
            suggestion.start = `${Math.floor(suggestion.startSeconds / 60)}:${String(Math.floor(suggestion.startSeconds % 60)).padStart(2, '0')}`;
            suggestion.end = `${Math.floor(suggestion.endSeconds / 60)}:${String(Math.floor(suggestion.endSeconds % 60)).padStart(2, '0')}`;
        }

        console.log(`🏆 Sports: AI suggests ${suggestion.start} - ${suggestion.end}: ${suggestion.reason}`);

        res.json({
            success: true,
            musicTitle,
            musicDuration,
            suggestion
        });

    } catch (error) {
        console.error('Sports analyze-music error:', error);
        res.status(500).json({
            error: 'Failed to analyze music',
            details: error.message
        });
    }
});

// Download specific section of music as audio
app.post('/api/sports/download-music-section', async (req, res) => {
    const { musicUrl, start, end } = req.body;

    if (!musicUrl || !start || !end) {
        return res.status(400).json({ error: 'musicUrl, start, and end are required' });
    }

    console.log(`🏆 Sports: Downloading music section ${start} - ${end}`);

    const timestamp = Date.now();
    const tempFilename = `music_temp_${timestamp}.webm`;
    const outputFilename = `music_${timestamp}.mp3`;
    const tempPath = path.join(DOWNLOADS_DIR, tempFilename);
    const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

    try {
        // Download full audio first (yt-dlp doesn't support time ranges for download)
        await new Promise((resolve, reject) => {
            const args = [
                '-f', 'bestaudio',
                '-x',
                '--audio-format', 'mp3',
                '--audio-quality', '0',
                '-o', tempPath,
                musicUrl
            ];

            const ytdlp = spawn('yt-dlp', args);
            let stderr = '';

            ytdlp.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`yt-dlp: ${data}`);
            });

            ytdlp.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`yt-dlp failed: ${stderr}`));
                } else {
                    resolve();
                }
            });

            ytdlp.on('error', reject);
        });

        // Find the actual downloaded file (might have different extension)
        const downloadedFiles = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.startsWith(`music_temp_${timestamp}`));
        const actualTempPath = downloadedFiles.length > 0 ? path.join(DOWNLOADS_DIR, downloadedFiles[0]) : tempPath;

        console.log(`🏆 Sports: Downloaded audio, extracting section...`);

        // Parse start time to seconds
        const parseTime = (timeStr) => {
            const parts = timeStr.split(':').map(Number);
            if (parts.length === 2) {
                return parts[0] * 60 + parts[1];
            } else if (parts.length === 3) {
                return parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
            return 0;
        };

        const startSec = parseTime(start);
        const endSec = parseTime(end);
        const duration = endSec - startSec;

        // Use FFmpeg to extract the section
        await new Promise((resolve, reject) => {
            const args = [
                '-i', actualTempPath,
                '-ss', String(startSec),
                '-t', String(duration),
                '-acodec', 'libmp3lame',
                '-ab', '192k',
                '-y',
                outputPath
            ];

            const ffmpeg = spawn('ffmpeg', args);
            let stderr = '';

            ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });

            ffmpeg.on('close', (code) => {
                // Cleanup temp file
                if (fs.existsSync(actualTempPath)) fs.unlinkSync(actualTempPath);

                if (code !== 0) {
                    console.error('FFmpeg error:', stderr);
                    reject(new Error('Failed to extract audio section'));
                } else {
                    resolve();
                }
            });

            ffmpeg.on('error', reject);
        });

        console.log(`🏆 Sports: Audio section extracted to ${outputFilename}`);

        res.json({
            success: true,
            filename: outputFilename,
            audioPath: `/api/videos/file/${outputFilename}`
        });

    } catch (error) {
        // Cleanup on error
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        console.error('Sports download-music-section error:', error);
        res.status(500).json({
            error: 'Failed to download music section',
            details: error.message
        });
    }
});

// Merge video with music audio
app.post('/api/sports/merge-video-music', async (req, res) => {
    const { videoFilename, audioFilename } = req.body;

    if (!videoFilename || !audioFilename) {
        return res.status(400).json({ error: 'videoFilename and audioFilename are required' });
    }

    const videoPath = path.join(DOWNLOADS_DIR, videoFilename);
    const audioPath = path.join(DOWNLOADS_DIR, audioFilename);

    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: 'Video file not found' });
    }

    if (!fs.existsSync(audioPath)) {
        return res.status(404).json({ error: 'Audio file not found' });
    }

    console.log(`🏆 Sports: Merging video ${videoFilename} with audio ${audioFilename}`);

    const timestamp = Date.now();
    const outputFilename = `sports_final_${timestamp}.mp4`;
    const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

    try {
        await new Promise((resolve, reject) => {
            const args = [
                '-i', videoPath,
                '-i', audioPath,
                '-map', '0:v',           // Take video from first input
                '-map', '1:a',           // Take audio from second input
                '-c:v', 'copy',          // Copy video codec (no re-encoding)
                '-c:a', 'aac',           // Encode audio to AAC
                '-b:a', '192k',
                '-shortest',             // End when shortest stream ends
                '-y',
                outputPath
            ];

            const ffmpeg = spawn('ffmpeg', args);
            let stderr = '';

            ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });

            ffmpeg.on('close', (code) => {
                if (code !== 0) {
                    console.error('FFmpeg merge error:', stderr);
                    reject(new Error('Failed to merge video and music'));
                } else {
                    resolve();
                }
            });

            ffmpeg.on('error', reject);
        });

        const stats = fs.statSync(outputPath);
        console.log(`🏆 Sports: Final video created (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

        res.json({
            success: true,
            filename: outputFilename,
            videoPath: `/api/videos/file/${outputFilename}`,
            size: stats.size
        });

    } catch (error) {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        console.error('Sports merge error:', error);
        res.status(500).json({
            error: 'Failed to merge video and music',
            details: error.message
        });
    }
});

// AI Music Suggestion - Analyze video and suggest best songs
app.post('/api/sports/ai-suggest-music', async (req, res) => {
    const { videoFilename } = req.body;

    if (!videoFilename) {
        return res.status(400).json({ error: 'videoFilename is required' });
    }

    const videoPath = path.join(DOWNLOADS_DIR, videoFilename);

    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: 'Video file not found' });
    }

    console.log(`🏆 Sports AI Music: Analyzing video ${videoFilename} for music suggestions`);

    try {
        // Import the Google GenAI library
        const { GoogleGenAI } = await import('@google/genai');

        const genAI = new GoogleGenAI({ apiKey: getGeminiApiKey() });

        // Upload the video to Gemini File API
        console.log(`🏆 Sports AI Music: Uploading video to Gemini...`);

        const videoBuffer = fs.readFileSync(videoPath);
        const base64Video = videoBuffer.toString('base64');

        // Get video duration for context
        const videoDuration = await new Promise((resolve) => {
            const ffprobe = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoPath]);
            let stdout = '';
            ffprobe.stdout.on('data', (data) => { stdout += data.toString(); });
            ffprobe.on('close', (code) => { resolve(code === 0 ? parseFloat(stdout.trim()) || 30 : 30); });
            ffprobe.on('error', () => resolve(30));
        });

        console.log(`🏆 Sports AI Music: Video duration: ${Math.round(videoDuration)}s, sending to Gemini...`);

        // Send to Gemini with video for analysis
        const model = genAI.models;

        const prompt = `You are a professional music supervisor for viral sports content (TikTok, Instagram Reels, YouTube Shorts).

Analyze this sports video and suggest the 3 BEST songs that would make this video go viral.

Video duration: ${Math.round(videoDuration)} seconds

For each song suggestion, provide:
1. The exact song title and artist
2. Why it fits this specific video (energy, pace, mood match)
3. The best section of the song to use (chorus/drop/hook) with approximate timestamps

Focus on:
- Popular, trending songs that work for sports content
- High-energy tracks with good drops or beats
- Songs commonly used in viral sports edits
- Consider the video's pace, action intensity, and mood

Return ONLY valid JSON in this exact format:
{
    "suggestions": [
        {
            "title": "Song Title",
            "artist": "Artist Name",
            "youtubeSearchQuery": "Artist - Song Title official audio",
            "reason": "Why this song fits the video",
            "suggestedStart": "1:05",
            "suggestedEnd": "1:35",
            "section": "chorus"
        }
    ]
}

Provide exactly 3 song suggestions. Make them diverse but all high-energy and fitting for sports content.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${getGeminiApiKey()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'video/mp4',
                                data: base64Video
                            }
                        },
                        { text: prompt }
                    ]
                }],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 1000
                }
            })
        });

        const aiData = await response.json();

        if (!response.ok) {
            console.error('Gemini API error:', aiData);
            throw new Error(aiData.error?.message || 'Gemini API error');
        }

        const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!content) {
            throw new Error('No content in AI response');
        }

        let suggestions;
        try {
            let jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
            const parsed = JSON.parse(jsonStr);
            suggestions = parsed.suggestions || [];
        } catch (parseError) {
            console.error('Failed to parse AI response:', content);
            // Provide fallback suggestions
            suggestions = [
                {
                    title: "Blinding Lights",
                    artist: "The Weeknd",
                    youtubeSearchQuery: "The Weeknd Blinding Lights official audio",
                    reason: "High-energy synth-wave track perfect for sports highlights",
                    suggestedStart: "0:43",
                    suggestedEnd: "1:13",
                    section: "chorus"
                },
                {
                    title: "Sicko Mode",
                    artist: "Travis Scott",
                    youtubeSearchQuery: "Travis Scott Sicko Mode official audio",
                    reason: "Intense beat drops ideal for action-packed sports content",
                    suggestedStart: "2:07",
                    suggestedEnd: "2:37",
                    section: "drop"
                },
                {
                    title: "Industry Baby",
                    artist: "Lil Nas X",
                    youtubeSearchQuery: "Lil Nas X Industry Baby official audio",
                    reason: "Triumphant, energetic track for victory moments",
                    suggestedStart: "1:02",
                    suggestedEnd: "1:32",
                    section: "chorus"
                }
            ];
        }

        console.log(`🏆 Sports AI Music: Generated ${suggestions.length} song suggestions`);

        res.json({
            success: true,
            videoDuration: Math.round(videoDuration),
            suggestions
        });

    } catch (error) {
        console.error('Sports AI Music suggest error:', error);
        res.status(500).json({
            error: 'Failed to analyze video for music suggestions',
            details: error.message
        });
    }
});

// ============================================
// ENTERTAINMENT ENDPOINTS - TV Moments & Movie Scenes
// ============================================

// AI Scene Suggestion - Suggest viral-worthy scenes from movies/TV shows
app.post('/api/entertainment/suggest-scenes', async (req, res) => {
    const { title, type = 'movie' } = req.body; // type: 'movie' | 'tv_show'

    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }

    console.log(`🎬 Entertainment AI: Analyzing "${title}" for viral scenes`);

    try {
        const prompt = `You are a viral content strategist specializing in short-form video content (TikTok, Instagram Reels, YouTube Shorts).

I want to create viral reel content from the ${type === 'tv_show' ? 'TV series' : 'movie'}: "${title}"

Suggest 5 SPECIFIC scenes or moments that would make VIRAL reels (under 45 seconds each).

For each suggestion, provide:
1. Scene Name - A catchy, memorable name for the scene
2. Description - What exactly happens in this scene (be specific about dialogue, action, or moment)
3. Why It's Viral - Explain why this would go viral (relatable, funny, emotional, quotable, etc.)
4. Episode/Timestamp Hint - If TV show, mention the episode. For movies, approximate time in the film (beginning, middle, end, or specific act)
5. Suggested Duration - How many seconds for the reel (10-45 sec range)
6. Caption Ideas - 2-3 caption/hook ideas for the reel
7. YouTube Search Query - Exact search terms to find this clip on YouTube

Focus on:
- Iconic, quotable moments
- Funny or emotionally powerful scenes
- Scenes with meme potential
- Plot twists or shocking reveals (without major spoilers)
- Character moments that are relatable
- Scenes that are already popular on TikTok/Reels

Return ONLY valid JSON in this exact format:
{
    "title": "${title}",
    "type": "${type}",
    "suggestions": [
        {
            "sceneName": "The Scene Name",
            "description": "What happens in this scene",
            "whyViral": "Why this would go viral",
            "locationHint": "Episode S1E3 around 15:00 / Movie - Act 2, middle portion",
            "duration": 30,
            "captionIdeas": ["Caption 1", "Caption 2"],
            "youtubeSearch": "exact search query to find this clip"
        }
    ]
}

Provide exactly 5 diverse suggestions covering different types of viral content (funny, emotional, iconic, etc).

IMPORTANT: Use Google Search to find ACTUAL viral clips and scenes from this ${type === 'tv_show' ? 'TV series' : 'movie'} that are popular on TikTok, Instagram Reels, or YouTube Shorts. Look for real scene names, actual episode numbers, and verified timestamps. Do not make up or hallucinate scenes.`;

        const responseSchema = {
            type: "object",
            properties: {
                title: { type: "string" },
                type: { type: "string" },
                suggestions: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            sceneName: { type: "string" },
                            description: { type: "string" },
                            whyViral: { type: "string" },
                            locationHint: { type: "string" },
                            duration: { type: "number" },
                            captionIdeas: { type: "array", items: { type: "string" } },
                            youtubeSearch: { type: "string" }
                        },
                        required: ["sceneName", "description", "whyViral", "locationHint", "duration", "captionIdeas", "youtubeSearch"]
                    }
                }
            },
            required: ["title", "type", "suggestions"]
        };

        const aiResponse = await callGeminiForNews(prompt, true); // Use search grounding

        if (!aiResponse) {
            throw new Error('No content in AI response');
        }

        console.log('🎬 Raw AI response (first 500 chars):', aiResponse.substring(0, 500));

        // Parse JSON from the response
        let result;
        try {
            // Clean markdown code blocks
            let cleanedResponse = aiResponse
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();

            // Try to find JSON object in response
            const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON object found in response');
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError.message);
            console.error('Response was:', aiResponse.substring(0, 1000));

            // Return fallback suggestions
            result = {
                title: title,
                type: type,
                suggestions: [
                    {
                        sceneName: "Popular Scene 1",
                        description: `Search for "${title} best scenes" on YouTube to find the most viral moments from this ${type === 'tv_show' ? 'series' : 'movie'}.`,
                        whyViral: "Iconic moments that resonate with audiences",
                        locationHint: "Check fan compilations on YouTube",
                        duration: 30,
                        captionIdeas: ["This scene hits different 💀", "POV: You're rewatching this for the 100th time"],
                        youtubeSearch: `${title} best scenes compilation`
                    }
                ]
            };
        }

        console.log(`🎬 Entertainment AI: Generated ${result.suggestions?.length || 0} scene suggestions for "${title}"`);

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Entertainment suggest-scenes error:', error);
        res.status(500).json({
            error: 'Failed to generate scene suggestions',
            details: error.message
        });
    }
});

// AI Text Overlay - Generate meme-style text for video
app.post('/api/entertainment/generate-text-overlay', async (req, res) => {
    const { videoFilename, customText } = req.body;

    if (!videoFilename) {
        return res.status(400).json({ error: 'Video filename is required' });
    }

    const videoPath = path.join(DOWNLOADS_DIR, videoFilename);
    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: 'Video file not found' });
    }

    console.log(`🎬 Text Overlay: Processing ${videoFilename}`);

    try {
        let overlayText = customText;

        // If no custom text, use AI to generate one
        if (!customText) {
            console.log('🎬 Text Overlay: Analyzing video with Gemini...');

            // Read video and convert to base64
            const videoBuffer = fs.readFileSync(videoPath);
            const base64Video = videoBuffer.toString('base64');

            const prompt = `You are a viral content expert who writes HOOKS for short-form videos. Analyze this video and generate a HOOK text that appears at the TOP of the video.

Your goal: Make viewers WATCH TILL THE END. The text should create curiosity, suspense, or hype.

HOOK TYPES THAT WORK:
1. **Curiosity Gap**: Tease what's about to happen without revealing it
2. **Bold Claim**: Make a statement that demands attention
3. **Challenge/Dare**: Imply the viewer won't expect what happens
4. **Relatable Setup**: "When you..." or "POV:" that viewers connect with
5. **Controversial Take**: A hot take that makes people want to see why

REQUIREMENTS:
- Maximum 8-10 words
- Must create URGENCY to keep watching
- Should work for TikTok/Reels/Shorts
- No spoilers - tease but don't reveal
- Use 1-2 emojis to make it pop (💀 🔥 😭 etc.)

BEST PERFORMING HOOKS:
- "Wait for it..."
- "Watch till the end 💀"
- "This is the scene everyone talks about"
- "I still can't believe this happened"
- "The ending will shock you"
- "POV: The moment everything changed"
- "This scene hits different at 3am"
- "You're not ready for this"
- "The most iconic scene of all time"

Return ONLY the hook text, nothing else. No quotes, no explanation.`;

            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use 1.5-flash for multimodal

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${getGeminiApiKey()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                inlineData: {
                                    mimeType: 'video/mp4',
                                    data: base64Video
                                }
                            },
                            { text: prompt }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.9,
                        maxOutputTokens: 100
                    }
                })
            });

            const aiData = await response.json();

            if (!response.ok) {
                console.error('Gemini API error:', aiData);
                overlayText = "POV: This moment hit different 💀";
            } else {
                overlayText = aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "POV: This moment hit different 💀";
                // Clean up the text
                overlayText = overlayText.replace(/^["']|["']$/g, '').trim();
            }

            console.log(`🎬 Text Overlay: AI generated text: "${overlayText}"`);
        }

        // Get video dimensions
        const probeResult = await new Promise((resolve, reject) => {
            const ffprobe = spawn('ffprobe', [
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_streams',
                videoPath
            ]);

            let output = '';
            ffprobe.stdout.on('data', data => output += data);
            ffprobe.on('close', code => {
                if (code === 0) {
                    try {
                        resolve(JSON.parse(output));
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error('ffprobe failed'));
                }
            });
        });

        const videoStream = probeResult.streams.find(s => s.codec_type === 'video');
        const videoWidth = parseInt(videoStream.width);
        const videoHeight = parseInt(videoStream.height);

        // Calculate output dimensions for 9:16 with text area on top
        const targetWidth = 1080;
        const textAreaHeight = 200; // Height for text overlay area
        const videoAreaHeight = Math.round(targetWidth * 16 / 9) - textAreaHeight;
        const totalHeight = textAreaHeight + videoAreaHeight;

        // Scale video to fit in videoAreaHeight while maintaining aspect ratio
        const scaledVideoHeight = videoAreaHeight;
        const scaledVideoWidth = Math.round(videoWidth * (videoAreaHeight / videoHeight));

        const outputFilename = `meme_overlay_${Date.now()}.mp4`;
        const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

        const textImagePath = path.join(DOWNLOADS_DIR, `text_overlay_${Date.now()}.png`);

        // Text style configuration
        const textStyle = req.body.textStyle || 'bold_shadow';
        const fontSize = 52;

        console.log(`🎬 Text Overlay: Rendering text with style "${textStyle}" (with emoji support): "${overlayText}"`);

        // Generate text as PNG using ImageMagick (supports emojis!)
        let imagemagickArgs;

        switch (textStyle) {
            case 'outline':
                imagemagickArgs = ['-size', `${targetWidth}x${textAreaHeight}`, 'xc:transparent', '-font', 'Impact', '-pointsize', String(fontSize), '-fill', 'white', '-stroke', 'black', '-strokewidth', '3', '-gravity', 'center', '-annotate', '0', overlayText, textImagePath];
                break;
            case 'box':
                imagemagickArgs = ['-size', `${targetWidth}x${textAreaHeight}`, 'xc:rgba(0,0,0,0.7)', '-font', 'Impact', '-pointsize', String(fontSize), '-fill', 'white', '-gravity', 'center', '-annotate', '0', overlayText, textImagePath];
                break;
            case 'neon':
                imagemagickArgs = ['-size', `${targetWidth}x${textAreaHeight}`, 'xc:transparent', '-font', 'Impact', '-pointsize', String(fontSize), '-fill', 'yellow', '-stroke', 'orange', '-strokewidth', '2', '-gravity', 'center', '-annotate', '0', overlayText, textImagePath];
                break;
            case 'bold_shadow':
            default:
                imagemagickArgs = ['-size', `${targetWidth}x${textAreaHeight}`, 'xc:transparent', '-font', 'Impact', '-pointsize', String(fontSize), '-fill', 'black', '-gravity', 'center', '-annotate', '+3+3', overlayText, '-fill', 'white', '-stroke', 'black', '-strokewidth', '2', '-gravity', 'center', '-annotate', '0', overlayText, textImagePath];
                break;
        }

        await new Promise((resolve, reject) => { const magick = spawn('magick', imagemagickArgs); magick.on('close', code => code === 0 ? resolve() : reject(new Error('ImageMagick failed'))); magick.on('error', reject); });

        console.log('🎬 Text Overlay: Text image created with emoji support');

        const filterComplex = [`color=black:${targetWidth}x${totalHeight}:d=999[bg]`, `[0:v]scale=${scaledVideoWidth}:${scaledVideoHeight}[scaled]`, `[bg][scaled]overlay=(W-w)/2:${textAreaHeight}[v1]`, `[v1][1:v]overlay=0:0[vout]`].join(';');

        const ffmpegArgs = ['-i', videoPath, '-i', textImagePath, '-filter_complex', filterComplex, '-map', '[vout]', '-map', '0:a?', '-c:v', 'libx264', '-c:a', 'aac', '-t', '60', '-y', outputPath];

        console.log('🎬 Text Overlay: Creating meme-style video...');

        await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', ffmpegArgs);
            ffmpeg.stderr.on('data', data => { /* progress */ });
            ffmpeg.on('close', code => {
                if (code === 0) resolve();
                else reject(new Error(`FFmpeg exited with code ${code}`));
            });
            ffmpeg.on('error', reject);
        });

        // Clean up temp text image
        if (fs.existsSync(textImagePath)) {
            fs.unlinkSync(textImagePath);
        }

        const stats = fs.statSync(outputPath);

        console.log(`🎬 Text Overlay: Created meme video (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

        res.json({
            success: true,
            overlayText,
            textStyle,
            videoPath: `/downloads/${outputFilename}`,
            filename: outputFilename,
            fileSize: stats.size
        });

    } catch (error) {
        console.error('Text overlay error:', error);
        res.status(500).json({
            error: 'Failed to generate text overlay',
            details: error.message
        });
    }
});

// ============================================
// NEWS SECTION ENDPOINTS (GEMINI POWERED)
// ============================================

// Fallback data for News Section
const NEWS_STATIC_FALLBACKS = {
    start: {
        question: "What broad category of news are you most interested in today?",
        options: ["Tech & Innovation", "Finance & Markets", "World Politics", "Entertainment & Sports"]
    },
    next: [
        { question: "What specific aspect interests you most?", options: ["Latest updates", "In-depth analysis", "Expert opinions", "Future trends"] },
        { question: "What's your preferred news format?", options: ["Quick headlines", "Detailed articles", "Data & statistics", "Visual stories"] },
        { question: "How current should the news be?", options: ["Breaking news", "Today's summary", "This week's highlights", "Archived gems"] }
    ],
    niche: {
        niche: "General News & Trends",
        keywords: ["news", "updates", "trending"]
    },
    headlines: [
        {
            title: "Global Tech Summit Announces Groundbreaking Innovations",
            summary: "The annual Tech Summit has kicked off with major announcements in AI, sustainable energy, and personal computing that could reshape the industry.",
            source: "Tech Journal",
            url: "#",
            publishedAt: "2 hours ago",
            trendingScore: 88,
            isLatest: true
        },
        {
            title: "Market Rally: Stocks Reach New Heights Amid Economic Optimism",
            summary: "Major indices saw a significant boost today as investors reacted positively to latest inflation data and employment reports.",
            source: "Financial Times",
            url: "#",
            publishedAt: "4 hours ago",
            trendingScore: 72,
            isLatest: false
        },
        {
            title: "Entertainment Weekly: Blockbuster Season Sets New Records",
            summary: "The latest box office numbers are in, and it's a historic year for cinemas worldwide with multiple films crossing the billion-dollar mark.",
            source: "Variety",
            url: "#",
            publishedAt: "5 hours ago",
            trendingScore: 95,
            isLatest: true
        }
    ]
};

// Start questionnaire - get initial question
app.post('/api/news/start-questionnaire', async (req, res) => {
    console.log('📰 News: Starting questionnaire (Gemini)');

    try {
        const prompt = `You are a news interest discovery assistant. Your job is to ask multiple choice questions to understand what type of news the user is interested in.

You must respond ONLY with valid JSON in this exact format:
{
    "question": "Your question here?",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
}

Start with a broad category question about news interests. Keep options concise (max 3-4 words each).`;

        const response = await callGeminiForNews(prompt);

        if (!response) {
            throw new Error('Gemini returned no response');
        }

        // Parse JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON in response');
        }
        const parsed = JSON.parse(jsonMatch[0]);

        res.json({
            success: true,
            question: parsed.question,
            options: parsed.options
        });

    } catch (error) {
        console.error('Start questionnaire error:', error.message);
        res.status(500).json({
            error: 'Failed to start questionnaire',
            details: error.message
        });
    }
});

// Next question - context-aware follow-up
app.post('/api/news/next-question', async (req, res) => {
    const { conversationHistory } = req.body;

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
        return res.status(400).json({ error: 'Missing conversationHistory array' });
    }

    console.log(`📰 News: Getting next question (Gemini, ${conversationHistory.length} previous answers)`);

    try {
        const historyText = conversationHistory.map((qa, idx) =>
            `Q${idx + 1}: ${qa.question}\nA${idx + 1}: ${qa.answer}`
        ).join('\n\n');

        const prompt = `You are a news interest discovery assistant. Based on previous answers, ask a more specific follow-up question to narrow down the user's exact news interests.

Here are the previous questions and answers:
${historyText}

You must respond ONLY with valid JSON in this exact format:
{
    "question": "Your follow-up question here?",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "isComplete": false
}

Make each question more specific based on previous answers. After 4 questions, set isComplete to true. Keep options concise.`;

        const response = await callGeminiForNews(prompt);

        if (!response) {
            throw new Error('Gemini returned no response');
        }

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON in response');
        }
        const parsed = JSON.parse(jsonMatch[0]);

        res.json({
            success: true,
            question: parsed.question,
            options: parsed.options,
            isComplete: parsed.isComplete || false
        });

    } catch (error) {
        console.error('Next question error:', error.message);
        res.status(500).json({
            error: 'Failed to get next question',
            details: error.message
        });
    }
});

// Finish questionnaire - extract niche
app.post('/api/news/finish-questionnaire', async (req, res) => {
    const { conversationHistory } = req.body;

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
        return res.status(400).json({ error: 'Missing conversationHistory array' });
    }

    console.log(`📰 News: Finishing questionnaire (Gemini) with ${conversationHistory.length} answers`);

    try {
        const historyText = conversationHistory.map((qa, idx) =>
            `Q${idx + 1}: ${qa.question}\nA${idx + 1}: ${qa.answer}`
        ).join('\n\n');

        const prompt = `You are a news interest analyzer. Based on the user's answers, determine their specific news niche and related keywords.

Answers:
${historyText}

Respond ONLY with valid JSON:
{
    "niche": "A concise 2-5 word description of their news interest",
    "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

Be specific. For example: "AI Startup Funding News" or "European Football Transfers" or "Crypto Market Analysis"`;

        const response = await callGeminiForNews(prompt);

        if (!response) {
            throw new Error('Gemini returned no response');
        }

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON in response');
        }
        const parsed = JSON.parse(jsonMatch[0]);

        res.json({
            success: true,
            niche: parsed.niche,
            keywords: parsed.keywords || []
        });

    } catch (error) {
        console.error('Finish questionnaire error:', error.message);
        res.status(500).json({
            error: 'Failed to finish questionnaire',
            details: error.message
        });
    }
});

// Fetch news using Gemini with Google Search grounding
app.post('/api/news/fetch', async (req, res) => {
    const { niche, keywords = [] } = req.body;

    if (!niche) {
        return res.status(400).json({ error: 'Missing niche parameter' });
    }

    console.log(`📰 News: Fetching news (Gemini + Search) for niche "${niche}"`);

    try {
        const prompt = `Find the latest, most trending news stories about: ${niche} ${keywords.join(' ')}.

Respond with a valid JSON array of 6 news items. Output ONLY the JSON array, no markdown, no explanation:
[
    {
        "title": "News headline",
        "summary": "2-3 sentence summary",
        "source": "News Source",
        "url": "https://example.com",
        "publishedAt": "2 hours ago",
        "trendingScore": 85,
        "isLatest": true
    }
]`;

        const response = await callGeminiForNews(prompt, true); // true for search grounding

        if (!response) {
            throw new Error('Gemini returned no response');
        }

        console.log('📰 Raw Gemini response (first 500 chars):', response.substring(0, 500));

        // Clean markdown code blocks first
        let cleanedResponse = response
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

        console.log('📰 Cleaned response (first 200 chars):', cleanedResponse.substring(0, 200));

        let headlines = [];

        // Try to parse - be permissive, don't fail
        try {
            headlines = JSON.parse(cleanedResponse);
            if (!Array.isArray(headlines)) headlines = [headlines];
        } catch (e) {
            // Try to find any JSON array in response
            const match = cleanedResponse.match(/\[[\s\S]*\]/);
            if (match) {
                try {
                    headlines = JSON.parse(match[0]);
                } catch (e2) {
                    // Just return whatever we got as raw content
                    headlines = [{
                        title: "Latest News",
                        summary: cleanedResponse.substring(0, 400),
                        source: "AI Search",
                        url: "#",
                        publishedAt: "Now",
                        trendingScore: 75,
                        isLatest: true
                    }];
                }
            } else {
                headlines = [{
                    title: "Latest News",
                    summary: cleanedResponse.substring(0, 400),
                    source: "AI Search",
                    url: "#",
                    publishedAt: "Now",
                    trendingScore: 75,
                    isLatest: true
                }];
            }
        }

        res.json({
            success: true,
            headlines: headlines,
            niche: niche
        });

    } catch (error) {
        console.error('Fetch news error:', error.message);
        res.status(500).json({
            error: 'Failed to fetch news',
            details: error.message
        });
    }
});

// Generate image prompt for news with Gemini
app.post('/api/news/generate-image-prompt', async (req, res) => {
    const { headline, style } = req.body;

    if (!headline || !style) {
        return res.status(400).json({ error: 'Missing headline or style parameter' });
    }

    console.log(`📰 News: Generating image prompt (Gemini) for: ${headline.title?.substring(0, 50)}...`);

    const stylePrompts = {
        minimalist: 'Clean, minimal design with bold sans-serif typography, plenty of white space, single accent color, modern and sleek',
        dramatic: 'High contrast, cinematic lighting, powerful imagery, dark moody background, impactful visual storytelling',
        infographic: 'Data visualization style, charts and icons, clean layout, informative graphics, professional color scheme',
        breaking: 'Urgent red accents, bold BREAKING NEWS style, attention-grabbing, news ticker aesthetic, high energy',
        quote: 'Elegant quote card design, pull quote highlighted, sophisticated typography, subtle gradient background',
        gradient: 'Modern gradient background (purple to blue or orange to pink), floating elements, contemporary social media style'
    };

    try {
        const prompt = `You are an expert at creating detailed image generation prompts.
        Create a detailed visual prompt for an image generator (like DALL-E) that captures this news story:
        Title: ${headline.title}
        Summary: ${headline.summary}

        Style Preset: ${style} (${stylePrompts[style] || 'modern Instagram aesthetic'})

        Rules:
        - Output ONLY the prompt text
        - Focus on composition, mood, colors, and lighting
        - Do not include any text, letters, or words in the image itself
        - Make it visually stunning and professional`;

        const imagePrompt = await callGeminiForNews(prompt);

        res.json({
            success: true,
            imagePrompt: imagePrompt || "A modern, professional news graphics background suitable for Instagram.",
            style: style
        });

    } catch (error) {
        console.error('Generate image prompt error:', error);
        res.status(500).json({
            error: 'Failed to generate image prompt',
            details: error.message
        });
    }
});

// Generate news image post with actual AI-generated images using Gemini Nano Banana
app.post('/api/news/generate-image-post', async (req, res) => {
    const { headline, style, format } = req.body;

    if (!headline || !style) {
        return res.status(400).json({ error: 'Missing headline or style parameter' });
    }

    const postFormat = format || 'single'; // 'single' or 'slider'
    console.log(`📰 News: Generating ${postFormat} image post for: ${headline.title?.substring(0, 50)}...`);

    try {
        // Step 1: Generate hook headline
        const hookPrompt = `You are an expert at creating viral social media headlines.
        Create a short, attention-grabbing hook headline for this news story:
        Title: ${headline.title}
        Summary: ${headline.summary}

        Rules:
        - Maximum 12 words
        - Use power words that evoke emotion or curiosity
        - Create urgency or intrigue
        - Perfect for Instagram/social media
        - Output ONLY the headline text, nothing else`;

        const hookHeadline = await callGeminiForNews(hookPrompt);
        console.log(`🎣 Hook headline: ${hookHeadline}`);

        // Step 1.5: Generate detailed news-style Instagram caption
        const captionPrompt = `You are an expert Instagram news content creator. Create a DETAILED, engaging Instagram caption for this news story:

        News Title: ${headline.title}
        Summary: ${headline.summary}
        Source: ${headline.source || 'News Source'}

        Create a caption that follows this structure:
        1. 🔥 HOOK (1-2 sentences that grab attention immediately)
        2. 📰 THE STORY (3-4 sentences explaining what happened, when, and why it matters)
        3. 💡 KEY POINTS (2-3 bullet points with important details)
        4. 🤔 WHY IT MATTERS (1-2 sentences on the significance/impact)
        5. 💬 CALL TO ACTION (Ask a question to encourage comments)
        6. Relevant hashtags (5-7 news-related hashtags)

        Rules:
        - Make it informative and news-worthy, not click-baity
        - Use emojis strategically but professionally
        - Write in a professional news tone
        - Include specific facts, numbers, or quotes if available
        - Total length: 150-250 words
        - Format with line breaks for readability
        - Output ONLY the caption text, no additional explanation`;

        const detailedCaption = await callGeminiForNews(captionPrompt);
        console.log(`📝 Generated detailed caption (${detailedCaption?.length || 0} chars)`);

        // Step 2: Prepare style-specific image prompts
        const stylePrompts = {
            minimalist: 'Clean minimal design, bold sans-serif typography, single accent color, modern and sleek, Instagram aesthetic',
            dramatic: 'High contrast, cinematic lighting, powerful imagery, dark moody background, impactful visual storytelling',
            infographic: 'Data visualization style, clean layout, informative graphics, professional color scheme',
            breaking: 'Urgent red accents, bold BREAKING NEWS style, attention-grabbing, high energy',
            quote: 'Elegant quote card design, sophisticated typography, subtle gradient background',
            gradient: 'Modern gradient background (purple to blue or orange to pink), floating elements, contemporary social media style'
        };

        const styleDesc = stylePrompts[style] || 'modern Instagram aesthetic';

        // Step 3: Generate images based on format
        const generatedImages = [];
        const imageCount = postFormat === 'slider' ? 4 : 1;

        for (let i = 0; i < imageCount; i++) {
            let imagePrompt;

            if (postFormat === 'single') {
                imagePrompt = `Create a professional Instagram news post image with text overlay.
                    
                    HEADLINE TEXT TO DISPLAY ON IMAGE (at the bottom):
                    "${hookHeadline || headline.title}"
                    
                    Background Context: ${headline.summary}
                    Visual Style: ${styleDesc}
                    
                    Requirements:
                    - Create a visually striking background image related to the news topic
                    - Include the HEADLINE TEXT prominently at the BOTTOM of the image
                    - Text should be bold, white or light colored, with dark shadow for readability
                    - Text should be large and easy to read on mobile
                    - Background should be darker at the bottom to make text pop
                    - Professional news graphic look like Instagram news pages
                    - Square format (1:1 aspect ratio)
                    - The headline text MUST be included and clearly readable`;
            } else {
                // Slider: Create a story progression
                const slideDescriptions = [
                    'Opening scene with main subject and brief intro text overlay',
                    'Key moment with impactful detail text overlay',
                    'Impact or consequence with context text overlay',
                    'Concluding message with call-to-action text overlay'
                ];

                const slideTexts = [
                    hookHeadline || headline.title,
                    headline.summary.split('.')[0] || 'Key Details',
                    headline.summary.split('.')[1] || 'The Impact',
                    'Swipe for more \u2192'
                ];

                imagePrompt = `Create slide ${i + 1} of 4 for Instagram news carousel with text overlay.
                    
                    TEXT TO DISPLAY ON THIS SLIDE:
                    "${slideTexts[i]}"
                    
                    News Context: ${headline.title}
                    Visual Style: ${styleDesc}
                    This slide focus: ${slideDescriptions[i]}
                    
                    Requirements:
                    - Professional Instagram carousel slide
                    - Include the TEXT prominently on the image
                    - Text should be bold, readable with good contrast
                    - Cohesive style with other carousel slides
                    - Square format (1:1)
                    - The text MUST be clearly visible and readable`;
            }

            console.log(`🖼️ Generating image ${i + 1}/${imageCount}...`);
            const result = await callGeminiForImageGeneration(imagePrompt);

            if (result && result.imageData) {
                generatedImages.push({
                    index: i,
                    base64: result.imageData.data,
                    mimeType: result.imageData.mimeType,
                    description: result.textResponse || `Slide ${i + 1}`
                });
                console.log(`✅ Generated image ${i + 1}`);
            } else {
                console.error(`❌ Failed to generate image ${i + 1}`);
            }

            // Small delay between requests to avoid rate limiting
            if (i < imageCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        if (generatedImages.length === 0) {
            throw new Error('Failed to generate any images');
        }

        // Return the generated post
        res.json({
            success: true,
            format: postFormat,
            hookHeadline: hookHeadline || headline.title,
            originalHeadline: headline.title,
            summary: detailedCaption || headline.summary,
            images: generatedImages,
            style: style,
            totalImages: generatedImages.length
        });

    } catch (error) {
        console.error('Generate image post error:', error);
        res.status(500).json({
            error: 'Failed to generate image post',
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🎙️  Podcast Studio Server running on http://localhost:${PORT}`);
    console.log(`📁 Downloads directory: ${DOWNLOADS_DIR}`);
});
