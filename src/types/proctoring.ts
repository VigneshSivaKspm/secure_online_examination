// Proctoring status types
export type ProctoringStatusType = 'GREEN' | 'YELLOW' | 'RED';

export interface ProctoringAlert {
  timestamp: number;
  reason: string;
  severity: 'warning' | 'critical';
}

export interface ProctoringStatus {
  status: ProctoringStatusType;
  reason: string | null;
  metrics: {
    mouthMoving: boolean;
    lookingAway: boolean;
    multipleFaces: boolean;
    headPoseAngle: number;
    mouthDistance: number;
  };
}

export interface LiveSession {
  studentId: string;
  examId: string;
  startTime: number;
  endTime?: number;
  alerts: ProctoringAlert[];
  status: 'active' | 'completed' | 'flagged';
}

export interface FaceLandmarkMetrics {
  mouthOpenness: number; // 0-1
  headPoseYaw: number; // degrees
  headPosePitch: number; // degrees
  headPoseRoll: number; // degrees
  irisPosition: {
    left: number; // 0-1, 0 = left, 1 = right
    top: number; // 0-1, 0 = top, 1 = bottom
  };
}
