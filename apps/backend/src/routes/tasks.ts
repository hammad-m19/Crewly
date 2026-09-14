import { Router } from 'express';
import { Task } from '../models';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/tasks?projectId=xxx
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { projectId, teamId } = req.query;

    if (!projectId) {
      return res.status(400).json({ success: false, error: { message: 'projectId is required' } });
    }

    const query: any = { projectId };
    if (teamId) {
      query.teamId = teamId;
    }

    const tasks = await Task.find(query).sort({ createdAt: -1 });

    res.json({ success: true, data: tasks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/tasks
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { projectId, teamId, description } = req.body;

    if (!projectId || !teamId || !description) {
      return res.status(400).json({
        success: false,
        error: { message: 'projectId, teamId, and description are required' },
      });
    }

    const task = new Task({
      projectId,
      teamId,
      description,
      isCompleted: false,
      createdBy: req.user!.userId,
    });

    await task.save();

    res.status(201).json({ success: true, data: task });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { isCompleted } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: { message: 'Task not found' } });
    }

    if (typeof isCompleted === 'boolean') {
      task.isCompleted = isCompleted;
      if (isCompleted) {
        task.completedAt = new Date();
      } else {
        task.completedAt = null;
      }
    }

    await task.save();
    res.json({ success: true, data: task });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

export default router;
