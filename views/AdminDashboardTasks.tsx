
import React, { useState, useEffect } from 'react';
import {
  ListChecks,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  GripVertical,
  Filter,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Drawer, PageHeader, Input, Select, ConfirmModal } from '../components/Shared';
import {
  fetchAllDashboardTasks,
  createDashboardTask,
  updateDashboardTask,
  deleteDashboardTask,
  reorderDashboardTasks
} from '../lib/supabase';

// --- Types ---

interface DashboardTask {
  id: string;
  week_number: number;
  title: string;
  link: string | null;
  order: number;
  created_at?: string;
  updated_at?: string;
}

const WEEK_OPTIONS = [
  { id: '0', label: 'Все недели' },
  { id: '1', label: 'Неделя 1' },
  { id: '2', label: 'Неделя 2' },
  { id: '3', label: 'Неделя 3' },
  { id: '4', label: 'Неделя 4' },
];

const AdminDashboardTasks: React.FC = () => {
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<DashboardTask[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('0');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<DashboardTask>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Deletion State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Drag and Drop
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Load tasks from database
  useEffect(() => {
    loadTasks();
  }, []);

  // Filter tasks when selection changes
  useEffect(() => {
    if (selectedWeek === '0') {
      setFilteredTasks(tasks);
    } else {
      setFilteredTasks(tasks.filter(t => t.week_number === parseInt(selectedWeek)));
    }
  }, [tasks, selectedWeek]);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const data = await fetchAllDashboardTasks();
      setTasks(data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Actions ---

  const openCreateDrawer = () => {
    setEditingTask({
      week_number: selectedWeek !== '0' ? parseInt(selectedWeek) : 1,
      title: '',
      link: '',
      order: filteredTasks.length + 1
    });
    setIsEditorOpen(true);
  };

  const openEditDrawer = (task: DashboardTask) => {
    setEditingTask(task);
    setIsEditorOpen(true);
  };

  const closeDrawer = () => {
    setIsEditorOpen(false);
    setEditingTask({});
  };

  const saveTask = async () => {
    if (!editingTask.title || !editingTask.week_number) {
      alert('Заполните все обязательные поля');
      return;
    }

    try {
      setIsSaving(true);

      if (editingTask.id) {
        // Update existing
        const updated = await updateDashboardTask(editingTask.id, {
          title: editingTask.title,
          link: editingTask.link || null,
          week_number: editingTask.week_number,
          order: editingTask.order
        });
        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
      } else {
        // Create new
        const created = await createDashboardTask({
          title: editingTask.title!,
          link: editingTask.link || undefined,
          week_number: editingTask.week_number!,
          order: editingTask.order || 1
        });
        setTasks(prev => [...prev, created]);
      }

      closeDrawer();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Ошибка при сохранении задачи');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setTaskToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (taskToDelete) {
      try {
        await deleteDashboardTask(taskToDelete);
        setTasks(prev => prev.filter(t => t.id !== taskToDelete));
        setIsDeleteModalOpen(false);
        setTaskToDelete(null);
      } catch (error) {
        console.error('Error deleting task:', error);
        alert('Ошибка при удалении задачи');
      }
    }
  };

  // --- Drag and Drop Handlers ---

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();

    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      setDraggedTaskId(null);
      return;
    }

    const draggedTask = filteredTasks.find(t => t.id === draggedTaskId);
    const targetTask = filteredTasks.find(t => t.id === targetTaskId);

    if (!draggedTask || !targetTask) {
      setDraggedTaskId(null);
      return;
    }

    // Reorder tasks
    const newTasks = [...filteredTasks];
    const draggedIndex = newTasks.findIndex(t => t.id === draggedTaskId);
    const targetIndex = newTasks.findIndex(t => t.id === targetTaskId);

    newTasks.splice(draggedIndex, 1);
    newTasks.splice(targetIndex, 0, draggedTask);

    // Update order values
    const reorderedTasks = newTasks.map((task, index) => ({
      ...task,
      order: index + 1
    }));

    // Optimistic update
    setFilteredTasks(reorderedTasks);
    setTasks(prev => {
      const updated = [...prev];
      reorderedTasks.forEach(reorderedTask => {
        const index = updated.findIndex(t => t.id === reorderedTask.id);
        if (index !== -1) {
          updated[index] = reorderedTask;
        }
      });
      return updated;
    });

    // Save to database
    try {
      await reorderDashboardTasks(
        reorderedTasks.map(t => ({ id: t.id, order: t.order }))
      );
    } catch (error) {
      console.error('Error reordering tasks:', error);
      // Reload on error
      loadTasks();
    }

    setDraggedTaskId(null);
  };

  // --- Render ---

  const tasksByWeek = filteredTasks.reduce((acc, task) => {
    const week = task.week_number;
    if (!acc[week]) acc[week] = [];
    acc[week].push(task);
    return acc;
  }, {} as Record<number, DashboardTask[]>);

  return (
    <div className="p-8 pb-32">
      <PageHeader
        title="Задачи дашборда"
        description="Управление задачами для студентов по неделям"
        icon={<ListChecks size={32} />}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter size={20} className="text-zinc-500" />
          <Select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="w-48"
          >
            {WEEK_OPTIONS.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </Select>
        </div>

        <div className="flex-1" />

        <button
          onClick={openCreateDrawer}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-medium"
        >
          <Plus size={20} />
          Добавить задачу
        </button>
      </div>

      {/* Tasks List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/5">
          <ListChecks size={48} className="mx-auto mb-4 text-zinc-400" />
          <p className="text-zinc-500 dark:text-zinc-400">
            {selectedWeek === '0' ? 'Нет задач' : `Нет задач для недели ${selectedWeek}`}
          </p>
          <button
            onClick={openCreateDrawer}
            className="mt-4 text-violet-600 hover:text-violet-700 font-medium"
          >
            Добавить первую задачу
          </button>
        </div>
      ) : selectedWeek === '0' ? (
        // Group by week
        <div className="space-y-8">
          {Object.keys(tasksByWeek)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(weekNum => (
              <div key={weekNum}>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                  Неделя {weekNum}
                </h3>
                <div className="space-y-3">
                  {tasksByWeek[parseInt(weekNum)]
                    .sort((a, b) => a.order - b.order)
                    .map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onEdit={openEditDrawer}
                        onDelete={confirmDelete}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        isDragging={draggedTaskId === task.id}
                      />
                    ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        // Single week
        <div className="space-y-3">
          {filteredTasks
            .sort((a, b) => a.order - b.order)
            .map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={openEditDrawer}
                onDelete={confirmDelete}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDragging={draggedTaskId === task.id}
              />
            ))}
        </div>
      )}

      {/* Editor Drawer */}
      <Drawer
        isOpen={isEditorOpen}
        onClose={closeDrawer}
        title={editingTask.id ? 'Редактировать задачу' : 'Новая задача'}
      >
        <div className="space-y-6">
          {/* Week */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Неделя <span className="text-red-500">*</span>
            </label>
            <Select
              value={editingTask.week_number?.toString() || '1'}
              onChange={(e) => setEditingTask({ ...editingTask, week_number: parseInt(e.target.value) })}
            >
              <option value="1">Неделя 1</option>
              <option value="2">Неделя 2</option>
              <option value="3">Неделя 3</option>
              <option value="4">Неделя 4</option>
            </Select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Текст задачи <span className="text-red-500">*</span>
            </label>
            <Input
              value={editingTask.title || ''}
              onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
              placeholder='Посмотреть урок "Как работает веб"'
            />
          </div>

          {/* Link */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Ссылка (опционально)
            </label>
            <Input
              value={editingTask.link || ''}
              onChange={(e) => setEditingTask({ ...editingTask, link: e.target.value })}
              placeholder="/lessons/1"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Если указана — задача становится кликабельной
            </p>
          </div>

          {/* Order */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Порядок отображения
            </label>
            <Input
              type="number"
              value={editingTask.order || 1}
              onChange={(e) => setEditingTask({ ...editingTask, order: parseInt(e.target.value) || 1 })}
              min="1"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Задачи сортируются по этому числу (меньше = выше)
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={closeDrawer}
              className="flex-1 px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium"
              disabled={isSaving}
            >
              Отмена
            </button>
            <button
              onClick={saveTask}
              disabled={isSaving || !editingTask.title || !editingTask.week_number}
              className="flex-1 px-4 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Сохранить
                </>
              )}
            </button>
          </div>
        </div>
      </Drawer>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={executeDelete}
        title="Удалить задачу?"
        message="Эта задача будет удалена из дашборда. Прогресс студентов по этой задаче также будет удалён."
      />
    </div>
  );
};

// --- Task Card Component ---

interface TaskCardProps {
  task: DashboardTask;
  onEdit: (task: DashboardTask) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  isDragging: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging
}) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      draggable
      onDragStart={(e) => onDragStart(e as any, task.id)}
      onDragOver={(e) => onDragOver(e as any)}
      onDrop={(e) => onDrop(e as any, task.id)}
      className={`group bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-white/5 hover:border-violet-300 dark:hover:border-violet-500/50 transition-all cursor-move ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Drag Handle */}
        <div className="mt-1 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors cursor-grab active:cursor-grabbing">
          <GripVertical size={20} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="font-medium text-zinc-900 dark:text-white">
                {task.title}
              </p>
              {task.link && (
                <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                  <LinkIcon size={12} />
                  <span className="truncate">{task.link}</span>
                </div>
              )}
            </div>

            {/* Order Badge */}
            <div className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg text-zinc-500">
              #{task.order}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(task)}
            className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-lg transition-colors"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminDashboardTasks;
