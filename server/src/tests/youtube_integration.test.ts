import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { 
  makeYouTubeStreamPublic, 
  getYouTubeStreamStatus, 
  updateYouTubeStreamMetadata,
  resetYouTubeMockData,
  getYouTubeMockData
} from '../handlers/youtube_integration';

describe('YouTube Integration', () => {
  // Valid test stream key
  const validStreamKey = 'abcd-1234-efgh-5678-ijkl';
  const shortStreamKey = '12345';
  
  beforeEach(() => {
    resetYouTubeMockData();
  });

  afterEach(() => {
    resetYouTubeMockData();
  });

  describe('makeYouTubeStreamPublic', () => {
    it('should successfully make a stream public', async () => {
      const result = await makeYouTubeStreamPublic(validStreamKey);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify stream data was created/updated
      const streamData = getYouTubeMockData(validStreamKey);
      expect(streamData).toBeDefined();
      expect(streamData!.privacyStatus).toBe('public');
      expect(streamData!.isLive).toBe(true);
      expect(streamData!.startTime).toBeInstanceOf(Date);
    });

    it('should reject invalid stream key', async () => {
      const result = await makeYouTubeStreamPublic(shortStreamKey);

      expect(result.success).toBe(false);
      expect(result.error).toEqual('Invalid stream key format');
    });

    it('should reject empty stream key', async () => {
      const result = await makeYouTubeStreamPublic('');

      expect(result.success).toBe(false);
      expect(result.error).toEqual('Invalid stream key format');
    });

    it('should handle non-string stream key', async () => {
      // @ts-ignore - Testing invalid input type
      const result = await makeYouTubeStreamPublic(null);

      expect(result.success).toBe(false);
      expect(result.error).toEqual('Invalid stream key format');
    });

    it('should create stream data for new stream key', async () => {
      const newStreamKey = 'new-stream-key-test-123';
      
      // Verify no data exists initially
      expect(getYouTubeMockData(newStreamKey)).toBeUndefined();

      const result = await makeYouTubeStreamPublic(newStreamKey);

      expect(result.success).toBe(true);
      
      // Verify stream data was created
      const streamData = getYouTubeMockData(newStreamKey);
      expect(streamData).toBeDefined();
      expect(streamData!.streamKey).toBe(newStreamKey);
      expect(streamData!.privacyStatus).toBe('public');
      expect(streamData!.isLive).toBe(true);
    });
  });

  describe('getYouTubeStreamStatus', () => {
    it('should return status for existing live stream', async () => {
      // First make a stream public to create data
      await makeYouTubeStreamPublic(validStreamKey);

      const status = await getYouTubeStreamStatus(validStreamKey);

      expect(status.is_live).toBe(true);
      expect(status.viewer_count).toBeGreaterThanOrEqual(0);
      expect(status.stream_title).toBeDefined();
      expect(status.privacy_status).toBe('public');
    });

    it('should return false for non-existent stream', async () => {
      const status = await getYouTubeStreamStatus('non-existent-key');

      expect(status.is_live).toBe(false);
      expect(status.viewer_count).toBeUndefined();
      expect(status.stream_title).toBeUndefined();
      expect(status.privacy_status).toBeUndefined();
    });

    it('should handle invalid stream key gracefully', async () => {
      const status = await getYouTubeStreamStatus('');

      expect(status.is_live).toBe(false);
    });

    it('should handle null stream key', async () => {
      // @ts-ignore - Testing invalid input type
      const status = await getYouTubeStreamStatus(null);

      expect(status.is_live).toBe(false);
    });

    it('should show viewer count increases over time for live streams', async () => {
      // Make stream public first
      await makeYouTubeStreamPublic(validStreamKey);

      const status1 = await getYouTubeStreamStatus(validStreamKey);
      
      // Wait a small amount and check again
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const status2 = await getYouTubeStreamStatus(validStreamKey);

      expect(status1.is_live).toBe(true);
      expect(status2.is_live).toBe(true);
      expect(typeof status1.viewer_count).toBe('number');
      expect(typeof status2.viewer_count).toBe('number');
    });
  });

  describe('updateYouTubeStreamMetadata', () => {
    const testMetadata = {
      title: 'Test Stream Title',
      description: 'This is a test stream description',
      tags: ['test', 'streaming', 'live']
    };

    it('should successfully update stream metadata', async () => {
      const result = await updateYouTubeStreamMetadata(validStreamKey, testMetadata);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify metadata was updated
      const streamData = getYouTubeMockData(validStreamKey);
      expect(streamData).toBeDefined();
      expect(streamData!.streamTitle).toBe(testMetadata.title);
      expect(streamData!.description).toBe(testMetadata.description);
      expect(streamData!.tags).toEqual(testMetadata.tags);
    });

    it('should reject invalid stream key', async () => {
      const result = await updateYouTubeStreamMetadata(shortStreamKey, testMetadata);

      expect(result.success).toBe(false);
      expect(result.error).toEqual('Invalid stream key format');
    });

    it('should reject empty metadata', async () => {
      const result = await updateYouTubeStreamMetadata(validStreamKey, {});

      expect(result.success).toBe(false);
      expect(result.error).toEqual('No metadata provided for update');
    });

    it('should update only title', async () => {
      const titleOnlyMetadata = { title: 'New Title Only' };
      const result = await updateYouTubeStreamMetadata(validStreamKey, titleOnlyMetadata);

      expect(result.success).toBe(true);
      
      const streamData = getYouTubeMockData(validStreamKey);
      expect(streamData!.streamTitle).toBe('New Title Only');
    });

    it('should update only description', async () => {
      const descriptionOnlyMetadata = { description: 'New description only' };
      const result = await updateYouTubeStreamMetadata(validStreamKey, descriptionOnlyMetadata);

      expect(result.success).toBe(true);
      
      const streamData = getYouTubeMockData(validStreamKey);
      expect(streamData!.description).toBe('New description only');
    });

    it('should update only tags', async () => {
      const tagsOnlyMetadata = { tags: ['new', 'tags', 'only'] };
      const result = await updateYouTubeStreamMetadata(validStreamKey, tagsOnlyMetadata);

      expect(result.success).toBe(true);
      
      const streamData = getYouTubeMockData(validStreamKey);
      expect(streamData!.tags).toEqual(['new', 'tags', 'only']);
    });

    it('should reject title exceeding 100 characters', async () => {
      const longTitle = 'a'.repeat(101);
      const result = await updateYouTubeStreamMetadata(validStreamKey, { title: longTitle });

      expect(result.success).toBe(false);
      expect(result.error).toEqual('Stream title exceeds 100 character limit');
    });

    it('should accept title at 100 character limit', async () => {
      const maxTitle = 'a'.repeat(100);
      const result = await updateYouTubeStreamMetadata(validStreamKey, { title: maxTitle });

      expect(result.success).toBe(true);
      
      const streamData = getYouTubeMockData(validStreamKey);
      expect(streamData!.streamTitle).toBe(maxTitle);
    });

    it('should reject description exceeding 5000 characters', async () => {
      const longDescription = 'a'.repeat(5001);
      const result = await updateYouTubeStreamMetadata(validStreamKey, { description: longDescription });

      expect(result.success).toBe(false);
      expect(result.error).toEqual('Stream description exceeds 5000 character limit');
    });

    it('should reject more than 30 tags', async () => {
      const tooManyTags = Array.from({ length: 31 }, (_, i) => `tag${i}`);
      const result = await updateYouTubeStreamMetadata(validStreamKey, { tags: tooManyTags });

      expect(result.success).toBe(false);
      expect(result.error).toEqual('Too many tags (maximum 30 allowed)');
    });

    it('should accept exactly 30 tags', async () => {
      const maxTags = Array.from({ length: 30 }, (_, i) => `tag${i}`);
      const result = await updateYouTubeStreamMetadata(validStreamKey, { tags: maxTags });

      expect(result.success).toBe(true);
      
      const streamData = getYouTubeMockData(validStreamKey);
      expect(streamData!.tags).toEqual(maxTags);
    });

    it('should reject tag exceeding 100 characters', async () => {
      const longTag = 'a'.repeat(101);
      const result = await updateYouTubeStreamMetadata(validStreamKey, { tags: [longTag] });

      expect(result.success).toBe(false);
      expect(result.error).toEqual('Tag exceeds 100 character limit');
    });

    it('should accept tag at 100 character limit', async () => {
      const maxTag = 'a'.repeat(100);
      const result = await updateYouTubeStreamMetadata(validStreamKey, { tags: [maxTag] });

      expect(result.success).toBe(true);
      
      const streamData = getYouTubeMockData(validStreamKey);
      expect(streamData!.tags).toContain(maxTag);
    });

    it('should create stream data for new stream key', async () => {
      const newStreamKey = 'metadata-test-key-456';
      
      // Verify no data exists initially
      expect(getYouTubeMockData(newStreamKey)).toBeUndefined();

      const result = await updateYouTubeStreamMetadata(newStreamKey, testMetadata);

      expect(result.success).toBe(true);
      
      // Verify stream data was created with metadata
      const streamData = getYouTubeMockData(newStreamKey);
      expect(streamData).toBeDefined();
      expect(streamData!.streamTitle).toBe(testMetadata.title);
      expect(streamData!.description).toBe(testMetadata.description);
      expect(streamData!.tags).toEqual(testMetadata.tags);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete workflow: make public, check status, update metadata', async () => {
      const workflowStreamKey = 'workflow-test-stream-789';
      
      // Step 1: Make stream public
      const publicResult = await makeYouTubeStreamPublic(workflowStreamKey);
      expect(publicResult.success).toBe(true);

      // Step 2: Check initial status
      const initialStatus = await getYouTubeStreamStatus(workflowStreamKey);
      expect(initialStatus.is_live).toBe(true);
      expect(initialStatus.privacy_status).toBe('public');

      // Step 3: Update metadata
      const metadata = {
        title: 'Updated Live Stream',
        description: 'Updated description for the live stream',
        tags: ['updated', 'live', 'stream']
      };
      const updateResult = await updateYouTubeStreamMetadata(workflowStreamKey, metadata);
      expect(updateResult.success).toBe(true);

      // Step 4: Verify final status includes updated metadata
      const finalStatus = await getYouTubeStreamStatus(workflowStreamKey);
      expect(finalStatus.is_live).toBe(true);
      expect(finalStatus.stream_title).toBe(metadata.title);
      expect(finalStatus.privacy_status).toBe('public');
    });

    it('should maintain separate state for different stream keys', async () => {
      const streamKey1 = 'stream-one-test-key';
      const streamKey2 = 'stream-two-test-key';

      // Set up different states for each stream
      await makeYouTubeStreamPublic(streamKey1);
      await updateYouTubeStreamMetadata(streamKey2, { 
        title: 'Private Stream',
        description: 'This stream is private'
      });

      // Verify each stream maintains its own state
      const status1 = await getYouTubeStreamStatus(streamKey1);
      const status2 = await getYouTubeStreamStatus(streamKey2);

      expect(status1.is_live).toBe(true);
      expect(status1.privacy_status).toBe('public');
      
      expect(status2.is_live).toBe(false); // Not made public
      expect(status2.stream_title).toBe('Private Stream');
    });
  });
});