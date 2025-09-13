import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { obsInstancesTable, scenesTable } from '../db/schema';
import { getScenesByObsInstance, refreshScenesFromObs, switchScene } from '../handlers/scenes';
import { eq, and } from 'drizzle-orm';

describe('Scene Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getScenesByObsInstance', () => {
    it('should return empty array when no scenes exist', async () => {
      // Create an OBS instance without scenes
      const obsResult = await db.insert(obsInstancesTable)
        .values({
          name: 'Test OBS',
          websocket_url: 'ws://localhost:4455',
          status: 'connected'
        })
        .returning()
        .execute();

      const scenes = await getScenesByObsInstance(obsResult[0].id);
      expect(scenes).toEqual([]);
    });

    it('should return all scenes for an OBS instance', async () => {
      // Create OBS instance
      const obsResult = await db.insert(obsInstancesTable)
        .values({
          name: 'Test OBS',
          websocket_url: 'ws://localhost:4455',
          status: 'connected'
        })
        .returning()
        .execute();

      const obsInstanceId = obsResult[0].id;

      // Create scenes
      const sceneData = [
        { name: 'Main Scene', is_active: true },
        { name: 'Intermission', is_active: false },
        { name: 'Starting Soon', is_active: false }
      ];

      for (const scene of sceneData) {
        await db.insert(scenesTable)
          .values({
            obs_instance_id: obsInstanceId,
            name: scene.name,
            is_active: scene.is_active
          })
          .execute();
      }

      const scenes = await getScenesByObsInstance(obsInstanceId);
      
      expect(scenes).toHaveLength(3);
      expect(scenes.map(s => s.name)).toContain('Main Scene');
      expect(scenes.map(s => s.name)).toContain('Intermission');
      expect(scenes.map(s => s.name)).toContain('Starting Soon');
      
      const activeScene = scenes.find(s => s.is_active);
      expect(activeScene?.name).toBe('Main Scene');
    });

    it('should only return scenes for the specified OBS instance', async () => {
      // Create two OBS instances
      const obs1 = await db.insert(obsInstancesTable)
        .values({
          name: 'OBS 1',
          websocket_url: 'ws://localhost:4455',
          status: 'connected'
        })
        .returning()
        .execute();

      const obs2 = await db.insert(obsInstancesTable)
        .values({
          name: 'OBS 2',
          websocket_url: 'ws://localhost:4456',
          status: 'connected'
        })
        .returning()
        .execute();

      // Create scenes for both instances
      await db.insert(scenesTable)
        .values({
          obs_instance_id: obs1[0].id,
          name: 'OBS1 Scene',
          is_active: true
        })
        .execute();

      await db.insert(scenesTable)
        .values({
          obs_instance_id: obs2[0].id,
          name: 'OBS2 Scene',
          is_active: true
        })
        .execute();

      const scenes1 = await getScenesByObsInstance(obs1[0].id);
      const scenes2 = await getScenesByObsInstance(obs2[0].id);

      expect(scenes1).toHaveLength(1);
      expect(scenes1[0].name).toBe('OBS1 Scene');
      
      expect(scenes2).toHaveLength(1);
      expect(scenes2[0].name).toBe('OBS2 Scene');
    });

    it('should handle database errors', async () => {
      // Test with non-existent OBS instance - should not throw but return empty array
      const scenes = await getScenesByObsInstance(999);
      expect(scenes).toEqual([]);
    });
  });

  describe('refreshScenesFromObs', () => {
    it('should throw error when OBS instance does not exist', async () => {
      await expect(refreshScenesFromObs(999))
        .rejects.toThrow(/OBS instance with id 999 not found/);
    });

    it('should create default scenes when none exist', async () => {
      // Create OBS instance
      const obsResult = await db.insert(obsInstancesTable)
        .values({
          name: 'Test OBS',
          websocket_url: 'ws://localhost:4455',
          status: 'disconnected'
        })
        .returning()
        .execute();

      const obsInstanceId = obsResult[0].id;

      const scenes = await refreshScenesFromObs(obsInstanceId);

      expect(scenes).toHaveLength(3);
      expect(scenes.map(s => s.name)).toContain('Main Scene');
      expect(scenes.map(s => s.name)).toContain('Intermission');
      expect(scenes.map(s => s.name)).toContain('Starting Soon');

      // Check that scenes were actually saved to database
      const dbScenes = await db.select()
        .from(scenesTable)
        .where(eq(scenesTable.obs_instance_id, obsInstanceId))
        .execute();

      expect(dbScenes).toHaveLength(3);

      // Check that OBS instance current_scene was updated
      const updatedObs = await db.select()
        .from(obsInstancesTable)
        .where(eq(obsInstancesTable.id, obsInstanceId))
        .execute();

      expect(updatedObs[0].current_scene).toBe('Main Scene');
    });

    it('should return existing scenes when they already exist', async () => {
      // Create OBS instance
      const obsResult = await db.insert(obsInstancesTable)
        .values({
          name: 'Test OBS',
          websocket_url: 'ws://localhost:4455',
          status: 'connected'
        })
        .returning()
        .execute();

      const obsInstanceId = obsResult[0].id;

      // Create existing scene
      await db.insert(scenesTable)
        .values({
          obs_instance_id: obsInstanceId,
          name: 'Existing Scene',
          is_active: true
        })
        .execute();

      const scenes = await refreshScenesFromObs(obsInstanceId);

      expect(scenes).toHaveLength(1);
      expect(scenes[0].name).toBe('Existing Scene');

      // Verify no new scenes were created
      const dbScenes = await db.select()
        .from(scenesTable)
        .where(eq(scenesTable.obs_instance_id, obsInstanceId))
        .execute();

      expect(dbScenes).toHaveLength(1);
    });

    it('should validate that scenes have required fields', async () => {
      // Create OBS instance
      const obsResult = await db.insert(obsInstancesTable)
        .values({
          name: 'Test OBS',
          websocket_url: 'ws://localhost:4455',
          status: 'connected'
        })
        .returning()
        .execute();

      const scenes = await refreshScenesFromObs(obsResult[0].id);

      scenes.forEach(scene => {
        expect(scene.id).toBeDefined();
        expect(scene.obs_instance_id).toBe(obsResult[0].id);
        expect(scene.name).toBeDefined();
        expect(typeof scene.is_active).toBe('boolean');
        expect(scene.created_at).toBeInstanceOf(Date);
        expect(scene.updated_at).toBeInstanceOf(Date);
      });
    });
  });

  describe('switchScene', () => {
    it('should return error when OBS instance does not exist', async () => {
      const result = await switchScene(999, 'Any Scene');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/OBS instance with id 999 not found/);
    });

    it('should return error when scene does not exist', async () => {
      // Create OBS instance
      const obsResult = await db.insert(obsInstancesTable)
        .values({
          name: 'Test OBS',
          websocket_url: 'ws://localhost:4455',
          status: 'connected'
        })
        .returning()
        .execute();

      const result = await switchScene(obsResult[0].id, 'Non-existent Scene');
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Scene 'Non-existent Scene' not found/);
    });

    it('should successfully switch to existing scene', async () => {
      // Create OBS instance
      const obsResult = await db.insert(obsInstancesTable)
        .values({
          name: 'Test OBS',
          websocket_url: 'ws://localhost:4455',
          status: 'connected',
          current_scene: 'Old Scene'
        })
        .returning()
        .execute();

      const obsInstanceId = obsResult[0].id;

      // Create scenes
      await db.insert(scenesTable)
        .values({
          obs_instance_id: obsInstanceId,
          name: 'Scene 1',
          is_active: true
        })
        .execute();

      await db.insert(scenesTable)
        .values({
          obs_instance_id: obsInstanceId,
          name: 'Scene 2',
          is_active: false
        })
        .execute();

      const result = await switchScene(obsInstanceId, 'Scene 2');
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify scene activation was updated
      const scenes = await db.select()
        .from(scenesTable)
        .where(eq(scenesTable.obs_instance_id, obsInstanceId))
        .execute();

      const scene1 = scenes.find(s => s.name === 'Scene 1');
      const scene2 = scenes.find(s => s.name === 'Scene 2');

      expect(scene1?.is_active).toBe(false);
      expect(scene2?.is_active).toBe(true);

      // Verify OBS instance current_scene was updated
      const updatedObs = await db.select()
        .from(obsInstancesTable)
        .where(eq(obsInstancesTable.id, obsInstanceId))
        .execute();

      expect(updatedObs[0].current_scene).toBe('Scene 2');
    });

    it('should deactivate all other scenes when switching', async () => {
      // Create OBS instance
      const obsResult = await db.insert(obsInstancesTable)
        .values({
          name: 'Test OBS',
          websocket_url: 'ws://localhost:4455',
          status: 'connected'
        })
        .returning()
        .execute();

      const obsInstanceId = obsResult[0].id;

      // Create multiple scenes, some active
      const sceneData = [
        { name: 'Scene 1', is_active: true },
        { name: 'Scene 2', is_active: true }, // Multiple active scenes
        { name: 'Scene 3', is_active: false }
      ];

      for (const scene of sceneData) {
        await db.insert(scenesTable)
          .values({
            obs_instance_id: obsInstanceId,
            name: scene.name,
            is_active: scene.is_active
          })
          .execute();
      }

      const result = await switchScene(obsInstanceId, 'Scene 3');
      
      expect(result.success).toBe(true);

      // Verify only Scene 3 is active
      const scenes = await db.select()
        .from(scenesTable)
        .where(eq(scenesTable.obs_instance_id, obsInstanceId))
        .execute();

      const activeScenes = scenes.filter(s => s.is_active);
      expect(activeScenes).toHaveLength(1);
      expect(activeScenes[0].name).toBe('Scene 3');
    });

    it('should not affect scenes from other OBS instances', async () => {
      // Create two OBS instances
      const obs1 = await db.insert(obsInstancesTable)
        .values({
          name: 'OBS 1',
          websocket_url: 'ws://localhost:4455',
          status: 'connected'
        })
        .returning()
        .execute();

      const obs2 = await db.insert(obsInstancesTable)
        .values({
          name: 'OBS 2',
          websocket_url: 'ws://localhost:4456',
          status: 'connected'
        })
        .returning()
        .execute();

      // Create scenes for both instances
      await db.insert(scenesTable)
        .values({
          obs_instance_id: obs1[0].id,
          name: 'OBS1 Scene A',
          is_active: true
        })
        .execute();

      await db.insert(scenesTable)
        .values({
          obs_instance_id: obs1[0].id,
          name: 'OBS1 Scene B',
          is_active: false
        })
        .execute();

      await db.insert(scenesTable)
        .values({
          obs_instance_id: obs2[0].id,
          name: 'OBS2 Scene A',
          is_active: true
        })
        .execute();

      // Switch scene in OBS1
      const result = await switchScene(obs1[0].id, 'OBS1 Scene B');
      expect(result.success).toBe(true);

      // Verify OBS1 scenes were affected
      const obs1Scenes = await db.select()
        .from(scenesTable)
        .where(eq(scenesTable.obs_instance_id, obs1[0].id))
        .execute();

      const obs1ActiveScene = obs1Scenes.find(s => s.is_active);
      expect(obs1ActiveScene?.name).toBe('OBS1 Scene B');

      // Verify OBS2 scenes were NOT affected
      const obs2Scenes = await db.select()
        .from(scenesTable)
        .where(eq(scenesTable.obs_instance_id, obs2[0].id))
        .execute();

      const obs2ActiveScene = obs2Scenes.find(s => s.is_active);
      expect(obs2ActiveScene?.name).toBe('OBS2 Scene A');
    });

    it('should handle switching to already active scene', async () => {
      // Create OBS instance
      const obsResult = await db.insert(obsInstancesTable)
        .values({
          name: 'Test OBS',
          websocket_url: 'ws://localhost:4455',
          status: 'connected',
          current_scene: 'Active Scene'
        })
        .returning()
        .execute();

      const obsInstanceId = obsResult[0].id;

      // Create scene that's already active
      await db.insert(scenesTable)
        .values({
          obs_instance_id: obsInstanceId,
          name: 'Active Scene',
          is_active: true
        })
        .execute();

      const result = await switchScene(obsInstanceId, 'Active Scene');
      
      expect(result.success).toBe(true);

      // Verify scene is still active
      const scenes = await db.select()
        .from(scenesTable)
        .where(and(
          eq(scenesTable.obs_instance_id, obsInstanceId),
          eq(scenesTable.name, 'Active Scene')
        ))
        .execute();

      expect(scenes[0].is_active).toBe(true);
    });
  });
});