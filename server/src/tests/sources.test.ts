import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { obsInstancesTable, scenesTable, sourcesTable } from '../db/schema';
import { getSourcesByScene } from '../handlers/sources';

describe('getSourcesByScene', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    it('should return sources for a specific scene', async () => {
        // Create prerequisite data
        const obsInstance = await db.insert(obsInstancesTable)
            .values({
                name: 'Test OBS',
                websocket_url: 'ws://localhost:4455'
            })
            .returning()
            .execute();

        const scene = await db.insert(scenesTable)
            .values({
                obs_instance_id: obsInstance[0].id,
                name: 'Test Scene'
            })
            .returning()
            .execute();

        // Create test sources
        const source1 = await db.insert(sourcesTable)
            .values({
                scene_id: scene[0].id,
                name: 'Camera Source',
                type: 'v4l2_input',
                is_enabled: true,
                settings: { device: '/dev/video0', resolution: '1920x1080' }
            })
            .returning()
            .execute();

        const source2 = await db.insert(sourcesTable)
            .values({
                scene_id: scene[0].id,
                name: 'Audio Source',
                type: 'pulse_input_capture',
                is_enabled: false,
                settings: null
            })
            .returning()
            .execute();

        // Test the handler
        const results = await getSourcesByScene(scene[0].id);

        // Verify results
        expect(results).toHaveLength(2);
        
        const cameraSource = results.find(s => s.name === 'Camera Source');
        expect(cameraSource).toBeDefined();
        expect(cameraSource!.type).toEqual('v4l2_input');
        expect(cameraSource!.is_enabled).toBe(true);
        expect(cameraSource!.settings).toEqual({ device: '/dev/video0', resolution: '1920x1080' });
        expect(cameraSource!.created_at).toBeInstanceOf(Date);

        const audioSource = results.find(s => s.name === 'Audio Source');
        expect(audioSource).toBeDefined();
        expect(audioSource!.type).toEqual('pulse_input_capture');
        expect(audioSource!.is_enabled).toBe(false);
        expect(audioSource!.settings).toBeNull();
    });

    it('should return empty array for scene with no sources', async () => {
        // Create prerequisite data
        const obsInstance = await db.insert(obsInstancesTable)
            .values({
                name: 'Test OBS',
                websocket_url: 'ws://localhost:4455'
            })
            .returning()
            .execute();

        const scene = await db.insert(scenesTable)
            .values({
                obs_instance_id: obsInstance[0].id,
                name: 'Empty Scene'
            })
            .returning()
            .execute();

        // Test the handler
        const results = await getSourcesByScene(scene[0].id);

        // Should return empty array
        expect(results).toHaveLength(0);
    });

    it('should return empty array for non-existent scene', async () => {
        // Test with non-existent scene ID
        const results = await getSourcesByScene(99999);

        // Should return empty array
        expect(results).toHaveLength(0);
    });

    it('should handle sources with complex settings', async () => {
        // Create prerequisite data
        const obsInstance = await db.insert(obsInstancesTable)
            .values({
                name: 'Test OBS',
                websocket_url: 'ws://localhost:4455'
            })
            .returning()
            .execute();

        const scene = await db.insert(scenesTable)
            .values({
                obs_instance_id: obsInstance[0].id,
                name: 'Complex Scene'
            })
            .returning()
            .execute();

        // Create source with complex settings
        const complexSettings = {
            playlist: [
                { file: '/path/to/video1.mp4', duration: 3600 },
                { file: '/path/to/video2.mp4', duration: 1800 }
            ],
            loop: true,
            shuffle: false,
            volume: 0.8,
            filters: {
                color_correction: { brightness: 0.1, contrast: 1.2 },
                crop: { left: 10, right: 10, top: 5, bottom: 5 }
            }
        };

        await db.insert(sourcesTable)
            .values({
                scene_id: scene[0].id,
                name: 'VLC Playlist',
                type: 'vlc_source',
                is_enabled: true,
                settings: complexSettings
            })
            .execute();

        // Test the handler
        const results = await getSourcesByScene(scene[0].id);

        // Verify complex settings are preserved
        expect(results).toHaveLength(1);
        expect(results[0].settings).toEqual(complexSettings);
        expect(results[0].settings!['playlist']).toHaveLength(2);
        expect(results[0].settings!['filters']['color_correction']['brightness']).toEqual(0.1);
    });

    it('should only return sources for the specified scene', async () => {
        // Create prerequisite data
        const obsInstance = await db.insert(obsInstancesTable)
            .values({
                name: 'Test OBS',
                websocket_url: 'ws://localhost:4455'
            })
            .returning()
            .execute();

        const scene1 = await db.insert(scenesTable)
            .values({
                obs_instance_id: obsInstance[0].id,
                name: 'Scene 1'
            })
            .returning()
            .execute();

        const scene2 = await db.insert(scenesTable)
            .values({
                obs_instance_id: obsInstance[0].id,
                name: 'Scene 2'
            })
            .returning()
            .execute();

        // Create sources for both scenes
        await db.insert(sourcesTable)
            .values({
                scene_id: scene1[0].id,
                name: 'Scene 1 Source',
                type: 'camera',
                is_enabled: true
            })
            .execute();

        await db.insert(sourcesTable)
            .values({
                scene_id: scene2[0].id,
                name: 'Scene 2 Source',
                type: 'microphone',
                is_enabled: true
            })
            .execute();

        // Test the handler for scene 1
        const scene1Results = await getSourcesByScene(scene1[0].id);
        expect(scene1Results).toHaveLength(1);
        expect(scene1Results[0].name).toEqual('Scene 1 Source');

        // Test the handler for scene 2
        const scene2Results = await getSourcesByScene(scene2[0].id);
        expect(scene2Results).toHaveLength(1);
        expect(scene2Results[0].name).toEqual('Scene 2 Source');
    });
});