const express = require('express');
const {
  listWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  listMembers,
  addWorkspaceMember,
  changeMemberRole,
  removeWorkspaceMember,
} = require('../controllers/WorkspaceController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.route('/').get(listWorkspaces).post(createWorkspace);
router.route('/:id').get(getWorkspace).put(updateWorkspace).delete(deleteWorkspace);
router.route('/:id/members').get(listMembers).post(addWorkspaceMember);
router.route('/:id/members/:userId').put(changeMemberRole).delete(removeWorkspaceMember);

module.exports = router;