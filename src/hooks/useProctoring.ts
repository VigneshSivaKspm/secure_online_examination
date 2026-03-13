import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type {
  ProctoringStatus,
  ProctoringStatusType,
} from '../types/proctoring';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

interface UseProctorConfig {
  studentId: string;
  examId: string;
  enabled?: boolean;
  alertThreshold?: number; // milliseconds between alerts
  lookingAwayThreshold?: number; // head yaw threshold for left/right turns (degrees)
  mouthMovementThreshold?: number; // distance threshold
  onWarningThresholdReached?: (count: number) => void; // Callback when 3 warnings reached
}

interface MouthMetrics {
  timestamp: number;
  distance: number;
}

/**
 * useProctoring - Custom hook for real-time exam proctoring using face detection
 * 
 * Tracks suspicious behaviors and counts warnings (0-3+)
 * 
 * Detects:
 * - Looking away: Head yaw (left/right rotation) > 75 degrees
 * - Multiple faces in frame
 * 
 * Warning System:
 * - Alert triggered when suspicious behavior detected
 * - Warning count incremented (callback fires at count=3)
 * - Teacher notified via Firestore updates
 * 
 * Logs alerts to Firebase for teacher monitoring
 */
export const useProctoring = ({
  studentId,
  examId,
  enabled = true,
  alertThreshold = 5000, // Don't alert more than once per 5 seconds
  lookingAwayThreshold = 60, // Head yaw threshold for left/right detection (degrees) - suspicious behavior
  mouthMovementThreshold = 0.08,
  onWarningThresholdReached,
}: UseProctorConfig) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // State management
  const [status, setStatus] = useState<ProctoringStatus>({
    status: 'GREEN',
    reason: null,
    metrics: {
      mouthMoving: false,
      lookingAway: false,
      multipleFaces: false,
      headPoseAngle: 0,
      mouthDistance: 0,
    },
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const [alerts, setAlerts] = useState<number[]>([]);
  const [warningCount, setWarningCount] = useState(0);

  // Tracking information
  const mouthMetricsRef = useRef<MouthMetrics[]>([]);
  const lastAlertTimeRef = useRef<number>(0);
  const sessionDocRef = useRef<string | null>(null);
  const warningCountRef = useRef<number>(0);

  /**
   * Calculate Euclidean distance between two points
   */
  const calculateDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  /**
   * Get mouth openness distance (distance between upper and lower lips)
   */
  const getMouthDistance = (landmarks: Array<{ x: number; y: number; z: number }>) => {
    // MediaPipe face landmarks: upper lip center (13), lower lip center (14)
    if (landmarks.length < 15) return 0;
    return calculateDistance(landmarks[13], landmarks[14]);
  };

  /**
   * Calculate head pose angles using facial landmarks
   * Returns { yaw, pitch, roll } in degrees
   */
  const getHeadPoseAngles = (landmarks: Array<{ x: number; y: number; z: number }>) => {
    // Using key landmarks to estimate head pose
    // Nose tip (1), left eye (33), right eye (263), left ear (234), right ear (454)
    const nose = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];

    // Estimate yaw (left-right rotation)
    const eyeDistance = Math.abs(rightEye.x - leftEye.x);
    const nosePosition = (nose.x - leftEye.x) / eyeDistance; // 0-1
    const yaw = (nosePosition - 0.5) * 100; // Convert to degrees estimate

    // Estimate pitch (up-down rotation) using z-coordinates
    const verticalDiff = nose.z - (leftEye.z + rightEye.z) / 2;
    const pitch = verticalDiff * 100;

    // Estimate roll using eye positions
    const eyeHeightDiff = leftEye.y - rightEye.y;
    const roll = Math.atan2(eyeHeightDiff, eyeDistance) * (180 / Math.PI);

    return { yaw, pitch, roll };
  };

  /**
   * Check if person is looking away (extreme head rotation only)
   * Note: Only triggers on very extreme head yaw to avoid false positives from normal head movements
   */
  const checkLookingAway = (
    headPose: ReturnType<typeof getHeadPoseAngles>
  ): boolean => {
    // Check head rotation - only flag extreme rotations
    if (Math.abs(headPose.yaw) > lookingAwayThreshold) {
      return true;
    }

    return false;
  };

  /**
   * Check if mouth is moving (lips apart) over the last 2 seconds
   */
  const checkMouthMoving = (currentDistance: number): boolean => {
    const now = Date.now();
    const twoSecondsAgo = now - 2000;

    // Add current metric
    mouthMetricsRef.current.push({ timestamp: now, distance: currentDistance });

    // Remove old metrics older than 2 seconds
    mouthMetricsRef.current = mouthMetricsRef.current.filter((m) => m.timestamp > twoSecondsAgo);

    // If we have enough metrics, check for significant change
    if (mouthMetricsRef.current.length < 5) return false;

    const distances = mouthMetricsRef.current.map((m) => m.distance);
    const minDistance = Math.min(...distances);
    const maxDistance = Math.max(...distances);
    const distanceChange = maxDistance - minDistance;

    return distanceChange > mouthMovementThreshold;
  };

  /**
   * Push alert to Firebase and track warning count
   */
  const pushAlertToFirebase = useCallback(
    async (reason: string) => {
      try {
        const now = Date.now();

        // Rate limit alerts
        if (now - lastAlertTimeRef.current < alertThreshold) {
          return;
        }

        lastAlertTimeRef.current = now;
        setAlerts((prev) => [...prev, now]);

        // Increment warning count
        warningCountRef.current += 1;
        setWarningCount(warningCountRef.current);

        // Trigger callback when warning count reaches 3
        if (warningCountRef.current === 3) {
          onWarningThresholdReached?.(3);
          console.warn('🚨 WARNING THRESHOLD REACHED: 3 suspicious activities detected!');
        }

        // Create or update session document
        if (!sessionDocRef.current) {
          const sessionsRef = collection(db, 'live_sessions');
          const newSession = await addDoc(sessionsRef, {
            studentId,
            examId,
            startTime: serverTimestamp(),
            endTime: null,
            status: 'active',
            totalAlerts: 1,
            warningCount: 1,
          });
          sessionDocRef.current = newSession.id;
        }

        // Add alert to subcollection
        const alertsRef = collection(db, 'live_sessions', sessionDocRef.current, 'alerts');
        await addDoc(alertsRef, {
          timestamp: serverTimestamp(),
          reason,
          severity: warningCountRef.current >= 3 ? 'critical' : 'warning',
          detectedAt: now,
          warningNumber: warningCountRef.current,
        });

        // Update session with warning count
        await updateDoc(doc(db, 'live_sessions', sessionDocRef.current), {
          warningCount: warningCountRef.current,
          totalAlerts: warningCountRef.current,
        });

        console.warn(`⚠️ Proctoring Warning (${warningCountRef.current}/3): ${reason}`);
      } catch (error) {
        console.error('Error pushing alert to Firebase:', error);
      }
    },
    [studentId, examId, alertThreshold, onWarningThresholdReached]
  );

  /**
   * Initialize MediaPipe FaceLandmarker
   */
  const initializeFaceLandmarker = useCallback(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
      );

      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        },
        runningMode: 'VIDEO',
        numFaces: 2, // Detect up to 2 faces to identify multiple people
      });

      faceLandmarkerRef.current = landmarker;
      setIsInitialized(true);
      console.log('✅ Face Landmarker initialized successfully');
    } catch (error) {
      console.error('Error initializing Face Landmarker:', error);
    }
  }, []);

  /**
   * Initialize webcam
   */
  const initializeWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = resolve;
          }
        });
        console.log('✅ Webcam initialized successfully');
      }
    } catch (error) {
      console.error('Error accessing webcam:', error);
    }
  }, []);

  /**
   * Detect face landmarks and check for suspicious activity
   */
  const detectAndAnalyze = useCallback(async () => {
    if (!faceLandmarkerRef.current || !videoRef.current || !enabled) {
      return;
    }

    // Skip detection if video element has no valid dimensions
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      animationFrameRef.current = requestAnimationFrame(detectAndAnalyze);
      return;
    }

    try {
      const results = faceLandmarkerRef.current.detectForVideo(videoRef.current, Date.now());

      if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
        setStatus((prev) => ({
          ...prev,
          status: 'RED',
          reason: 'No face detected - please ensure your face is visible',
        }));
        animationFrameRef.current = requestAnimationFrame(detectAndAnalyze);
        return;
      }

      // Check for multiple faces
      const multipleFaces = results.faceLandmarks.length > 1;
      if (multipleFaces) {
        setStatus((prev) => ({
          ...prev,
          status: 'RED',
          reason: 'Multiple people detected in frame',
          metrics: { ...prev.metrics, multipleFaces: true },
        }));
        await pushAlertToFirebase('Multiple faces detected');
      }

      // Analyze primary face (first detected)
      const landmarks = results.faceLandmarks[0];

      // Calculate metrics
      const mouthDistance = getMouthDistance(landmarks);
      const headPose = getHeadPoseAngles(landmarks);
      // Note: Mouth movement detection kept for metrics but not for alerts (disabled in production)
      const mouthMoving = checkMouthMoving(mouthDistance);
      const lookingAway = checkLookingAway(headPose);

      // Update status
      let newStatus: ProctoringStatusType = 'GREEN';
      let reason: string | null = null;

      // Only trigger alerts on head yaw (looking away) - not on mouth movement
      if (lookingAway) {
        newStatus = 'RED';
        reason = `Looking away detected (Head Yaw: ${Math.abs(headPose.yaw).toFixed(1)}°)`;
        await pushAlertToFirebase(reason);
      } else if (multipleFaces) {
        newStatus = 'RED';
        reason = 'Multiple people in frame';
        await pushAlertToFirebase(reason);
      }

      setStatus({
        status: newStatus,
        reason,
        metrics: {
          mouthMoving,
          lookingAway,
          multipleFaces,
          headPoseAngle: Math.abs(headPose.yaw),
          mouthDistance,
        },
      });
    } catch (error) {
      console.error('Error during face detection:', error);
    }

    animationFrameRef.current = requestAnimationFrame(detectAndAnalyze);
  }, [enabled, pushAlertToFirebase]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    if (!enabled) return;

    const initialize = async () => {
      await initializeFaceLandmarker();
      await initializeWebcam();
    };

    initialize();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, [enabled, initializeFaceLandmarker, initializeWebcam]);

  /**
   * Start detection loop once initialized
   */
  useEffect(() => {
    if (isInitialized && enabled) {
      animationFrameRef.current = requestAnimationFrame(detectAndAnalyze);
    }
  }, [isInitialized, enabled, detectAndAnalyze]);

  /**
   * Cleanup and finalize session on dismount
   */
  useEffect(() => {
    return () => {
      if (sessionDocRef.current) {
        updateDoc(doc(db, 'live_sessions', sessionDocRef.current), {
          endTime: serverTimestamp(),
          status: alerts.length > 0 ? 'flagged' : 'completed',
          totalAlerts: alerts.length,
        }).catch((error) => console.error('Error finalizing session:', error));
      }
    };
  }, [alerts]);

  return {
    videoRef,
    status,
    isInitialized,
    alerts,
    alertCount: alerts.length,
    warningCount,
  };
};
