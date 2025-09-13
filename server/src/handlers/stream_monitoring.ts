export interface StreamStatus {
    obs_instance_id: number;
    is_streaming: boolean;
    current_scene: string | null;
    stream_duration: number; // in seconds
    video_position: number | null; // current position in video source
    video_duration: number | null; // total duration of video source
    sources: Array<{
        name: string;
        enabled: boolean;
        type: string;
    }>;
}

export async function getStreamStatus(obsInstanceId: number): Promise<StreamStatus> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to get real-time status of a stream including
    // current scene, source states, and video playback position.
    return Promise.resolve({
        obs_instance_id: obsInstanceId,
        is_streaming: false,
        current_scene: null,
        stream_duration: 0,
        video_position: null,
        video_duration: null,
        sources: []
    });
}

export async function getAllStreamStatuses(): Promise<StreamStatus[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to get status of all connected OBS instances
    // for the dashboard display.
    return [];
}

export async function setVideoStartPosition(obsInstanceId: number, sourceName: string, position: number): Promise<{ success: boolean; message: string }> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to set the start position for video sources
    // when a stream begins (e.g., "play from 10 minutes in").
    return Promise.resolve({
        success: true,
        message: `Video start position set to ${position} seconds for source ${sourceName}`
    });
}