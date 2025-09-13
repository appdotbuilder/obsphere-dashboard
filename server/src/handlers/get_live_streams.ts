import { type LiveStream } from '../schema';

export const getLiveStreams = async (): Promise<LiveStream[]> => {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching all active live streams from the database
    // with their associated OBS instance information and current viewer counts.
    // Should also update viewer counts from YouTube API if quota allows.
    return [];
}

export const getLiveStreamsHistory = async (): Promise<LiveStream[]> => {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching ended live streams (history)
    // ordered by ended_at timestamp descending for recent streams first.
    return [];
}