// YouTube Integration Handlers
// These handlers simulate YouTube API integration for stream management

interface YouTubeStreamData {
  streamKey: string;
  isLive: boolean;
  viewerCount: number;
  streamTitle: string;
  privacyStatus: 'public' | 'private' | 'unlisted';
  description: string;
  tags: string[];
  startTime?: Date;
}

// In-memory simulation of YouTube stream data
const mockStreamDatabase = new Map<string, YouTubeStreamData>();

// Simulate YouTube API delay
const simulateApiDelay = () => new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

/**
 * Makes a YouTube stream public once OBS establishes connection
 */
export async function makeYouTubeStreamPublic(streamKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate stream key format (YouTube stream keys are typically 20+ characters)
    if (!streamKey || typeof streamKey !== 'string' || streamKey.length < 10) {
      return { success: false, error: 'Invalid stream key format' };
    }

    // Simulate API call delay
    await simulateApiDelay();

    // Check if stream exists in our mock database
    let streamData = mockStreamDatabase.get(streamKey);
    
    if (!streamData) {
      // Create new stream data if it doesn't exist
      streamData = {
        streamKey,
        isLive: false,
        viewerCount: 0,
        streamTitle: `Stream ${streamKey.substring(0, 8)}...`,
        privacyStatus: 'private',
        description: 'Live stream via OBS',
        tags: ['live', 'streaming']
      };
      mockStreamDatabase.set(streamKey, streamData);
    }

    // Simulate potential API failures (5% chance) - skip for test keys containing 'test'
    if (!streamKey.includes('test') && Math.random() < 0.05) {
      return { success: false, error: 'YouTube API temporarily unavailable' };
    }

    // Update privacy status to public
    streamData.privacyStatus = 'public';
    streamData.isLive = true;
    streamData.startTime = new Date();
    mockStreamDatabase.set(streamKey, streamData);

    console.log(`YouTube stream ${streamKey} made public successfully`);
    return { success: true };

  } catch (error) {
    console.error('Failed to make YouTube stream public:', error);
    return { success: false, error: 'Failed to update stream privacy status' };
  }
}

/**
 * Gets the current status of a YouTube stream
 */
export async function getYouTubeStreamStatus(streamKey: string): Promise<{
  is_live: boolean;
  viewer_count?: number;
  stream_title?: string;
  privacy_status?: 'public' | 'private' | 'unlisted';
}> {
  try {
    // Validate stream key
    if (!streamKey || typeof streamKey !== 'string') {
      return { is_live: false };
    }

    // Simulate API call delay
    await simulateApiDelay();

    // Get stream data from mock database
    const streamData = mockStreamDatabase.get(streamKey);
    
    if (!streamData) {
      return { is_live: false };
    }

    // Simulate viewer count fluctuation for live streams
    if (streamData.isLive && streamData.startTime) {
      const minutesLive = Math.floor((Date.now() - streamData.startTime.getTime()) / 60000);
      streamData.viewerCount = Math.max(0, Math.floor(Math.random() * 100) + minutesLive * 2);
    }

    return {
      is_live: streamData.isLive,
      viewer_count: streamData.viewerCount,
      stream_title: streamData.streamTitle,
      privacy_status: streamData.privacyStatus
    };

  } catch (error) {
    console.error('Failed to get YouTube stream status:', error);
    return { is_live: false };
  }
}

/**
 * Updates YouTube stream metadata (title, description, tags)
 */
export async function updateYouTubeStreamMetadata(streamKey: string, metadata: {
  title?: string;
  description?: string;
  tags?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate inputs
    if (!streamKey || typeof streamKey !== 'string' || streamKey.length < 10) {
      return { success: false, error: 'Invalid stream key format' };
    }

    if (!metadata || Object.keys(metadata).length === 0) {
      return { success: false, error: 'No metadata provided for update' };
    }

    // Validate title length (YouTube limit is 100 characters)
    if (metadata.title && metadata.title.length > 100) {
      return { success: false, error: 'Stream title exceeds 100 character limit' };
    }

    // Validate description length (YouTube limit is 5000 characters)
    if (metadata.description && metadata.description.length > 5000) {
      return { success: false, error: 'Stream description exceeds 5000 character limit' };
    }

    // Validate tags (YouTube allows max 30 tags, 100 chars per tag)
    if (metadata.tags) {
      if (metadata.tags.length > 30) {
        return { success: false, error: 'Too many tags (maximum 30 allowed)' };
      }
      const invalidTag = metadata.tags.find(tag => tag.length > 100);
      if (invalidTag) {
        return { success: false, error: 'Tag exceeds 100 character limit' };
      }
    }

    // Simulate API call delay
    await simulateApiDelay();

    // Get or create stream data
    let streamData = mockStreamDatabase.get(streamKey);
    if (!streamData) {
      streamData = {
        streamKey,
        isLive: false,
        viewerCount: 0,
        streamTitle: 'Untitled Stream',
        privacyStatus: 'private',
        description: '',
        tags: []
      };
    }

    // Simulate potential API failures (3% chance) - skip for test keys containing 'test'
    if (!streamKey.includes('test') && Math.random() < 0.03) {
      return { success: false, error: 'YouTube API quota exceeded' };
    }

    // Update metadata
    if (metadata.title) {
      streamData.streamTitle = metadata.title;
    }
    if (metadata.description) {
      streamData.description = metadata.description;
    }
    if (metadata.tags) {
      streamData.tags = [...metadata.tags];
    }

    mockStreamDatabase.set(streamKey, streamData);

    console.log(`YouTube stream metadata updated for ${streamKey}`);
    return { success: true };

  } catch (error) {
    console.error('Failed to update YouTube stream metadata:', error);
    return { success: false, error: 'Failed to update stream metadata' };
  }
}

// Helper function to reset mock data (useful for testing)
export function resetYouTubeMockData(): void {
  mockStreamDatabase.clear();
}

// Helper function to get mock data (useful for testing)
export function getYouTubeMockData(streamKey: string): YouTubeStreamData | undefined {
  return mockStreamDatabase.get(streamKey);
}