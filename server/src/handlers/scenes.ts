import { db } from '../db';
import { scenesTable, obsInstancesTable } from '../db/schema';
import { type Scene } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function getScenesByObsInstance(obsInstanceId: number): Promise<Scene[]> {
  try {
    // Fetch all scenes for the specified OBS instance
    const scenes = await db.select()
      .from(scenesTable)
      .where(eq(scenesTable.obs_instance_id, obsInstanceId))
      .execute();

    return scenes;
  } catch (error) {
    console.error('Failed to fetch scenes for OBS instance:', error);
    throw error;
  }
}

export async function refreshScenesFromObs(obsInstanceId: number): Promise<Scene[]> {
  try {
    // Verify the OBS instance exists
    const obsInstances = await db.select()
      .from(obsInstancesTable)
      .where(eq(obsInstancesTable.id, obsInstanceId))
      .execute();

    if (obsInstances.length === 0) {
      throw new Error(`OBS instance with id ${obsInstanceId} not found`);
    }

    // In a real implementation, this would:
    // 1. Connect to OBS WebSocket using the websocket_url from obsInstances[0]
    // 2. Fetch the current scene list via GetSceneList command
    // 3. Compare with existing scenes in database
    // 4. Insert new scenes, update existing ones, remove deleted ones
    // 5. Update the current_scene in obs_instances table
    
    // For now, we'll simulate adding some default scenes if none exist
    const existingScenes = await db.select()
      .from(scenesTable)
      .where(eq(scenesTable.obs_instance_id, obsInstanceId))
      .execute();

    if (existingScenes.length === 0) {
      // Insert default scenes to simulate OBS connection
      const defaultScenes = [
        { name: 'Main Scene', is_active: true },
        { name: 'Intermission', is_active: false },
        { name: 'Starting Soon', is_active: false }
      ];

      const insertedScenes = [];
      for (const sceneData of defaultScenes) {
        const result = await db.insert(scenesTable)
          .values({
            obs_instance_id: obsInstanceId,
            name: sceneData.name,
            is_active: sceneData.is_active
          })
          .returning()
          .execute();
        
        insertedScenes.push(result[0]);
      }

      // Update the OBS instance's current scene
      await db.update(obsInstancesTable)
        .set({
          current_scene: 'Main Scene',
          updated_at: new Date()
        })
        .where(eq(obsInstancesTable.id, obsInstanceId))
        .execute();

      return insertedScenes;
    }

    // Return existing scenes if they already exist
    return existingScenes;
  } catch (error) {
    console.error('Failed to refresh scenes from OBS:', error);
    throw error;
  }
}

export async function switchScene(obsInstanceId: number, sceneName: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify the OBS instance exists
    const obsInstances = await db.select()
      .from(obsInstancesTable)
      .where(eq(obsInstancesTable.id, obsInstanceId))
      .execute();

    if (obsInstances.length === 0) {
      return { success: false, error: `OBS instance with id ${obsInstanceId} not found` };
    }

    // Verify the target scene exists for this OBS instance
    const targetScene = await db.select()
      .from(scenesTable)
      .where(and(
        eq(scenesTable.obs_instance_id, obsInstanceId),
        eq(scenesTable.name, sceneName)
      ))
      .execute();

    if (targetScene.length === 0) {
      return { success: false, error: `Scene '${sceneName}' not found for OBS instance ${obsInstanceId}` };
    }

    // In a real implementation, this would:
    // 1. Send SetCurrentProgramScene command to OBS WebSocket
    // 2. Wait for confirmation or timeout
    // 3. Update database only if OBS command succeeds

    // Deactivate all scenes for this OBS instance
    await db.update(scenesTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(scenesTable.obs_instance_id, obsInstanceId))
      .execute();

    // Activate the target scene
    await db.update(scenesTable)
      .set({ 
        is_active: true,
        updated_at: new Date()
      })
      .where(and(
        eq(scenesTable.obs_instance_id, obsInstanceId),
        eq(scenesTable.name, sceneName)
      ))
      .execute();

    // Update the OBS instance's current scene
    await db.update(obsInstancesTable)
      .set({
        current_scene: sceneName,
        updated_at: new Date()
      })
      .where(eq(obsInstancesTable.id, obsInstanceId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Failed to switch scene:', error);
    return { success: false, error: 'Internal error occurred while switching scene' };
  }
}