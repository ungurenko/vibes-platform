
import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Calendar,
  Link as LinkIcon,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  GripVertical
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader, Input, ConfirmModal, Drawer } from '../components/Shared';
import {
  fetchDashboardSettings,
  updateDashboardSettings,
  fetchAllQuickLinks,
  createQuickLink,
  updateQuickLink,
  deleteQuickLink,
  reorderQuickLinks
} from '../lib/supabase';

// --- Types ---

interface DashboardSettings {
  greeting_template: string;
  show_week_indicator: boolean;
  show_calls_block: boolean;
  no_calls_text: string;
  cohort_start_date: string | null;
  week_duration_days: number;
  total_weeks: number;
}

interface QuickLink {
  id: string;
  title: string;
  icon: string;
  url: string;
  order: number;
  is_active: boolean;
}

const ICON_OPTIONS = [
  { value: 'palette', label: '🎨 Палитра' },
  { value: 'terminal', label: '💻 Терминал' },
  { value: 'book', label: '📖 Книга' },
  { value: 'bot', label: '🤖 Робот' },
  { value: 'map', label: '🗺️ Карта' },
  { value: 'settings', label: '⚙️ Настройки' },
  { value: 'star', label: '⭐ Звезда' },
  { value: 'rocket', label: '🚀 Ракета' },
];

const AdminDashboardSettings: React.FC = () => {
  // Settings state
  const [settings, setSettings] = useState<DashboardSettings>({
    greeting_template: 'Привет, {name}!',
    show_week_indicator: true,
    show_calls_block: true,
    no_calls_text: 'Нет запланированных созвонов',
    cohort_start_date: null,
    week_duration_days: 7,
    total_weeks: 4
  });

  // Quick links state
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Partial<QuickLink>>({});

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<string | null>(null);

  // Drag state
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [settingsData, linksData] = await Promise.all([
        fetchDashboardSettings(),
        fetchAllQuickLinks(false)
      ]);
      setSettings(settingsData);
      setQuickLinks(linksData);
    } catch (error) {
      console.error('Error loading dashboard settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Settings Actions ---

  const saveSettings = async () => {
    try {
      setIsSavingSettings(true);
      await updateDashboardSettings(settings);
      alert('Настройки сохранены');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Ошибка при сохранении настроек');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // --- Quick Links Actions ---

  const openCreateLinkDrawer = () => {
    if (quickLinks.length >= 6) {
      alert('Максимум 6 быстрых ссылок. Удалите существующую, чтобы добавить новую.');
      return;
    }

    setEditingLink({
      title: '',
      icon: 'palette',
      url: '',
      order: quickLinks.length + 1,
      is_active: true
    });
    setIsLinkEditorOpen(true);
  };

  const openEditLinkDrawer = (link: QuickLink) => {
    setEditingLink(link);
    setIsLinkEditorOpen(true);
  };

  const closeLinkDrawer = () => {
    setIsLinkEditorOpen(false);
    setEditingLink({});
  };

  const saveLink = async () => {
    if (!editingLink.title || !editingLink.icon || !editingLink.url) {
      alert('Заполните все обязательные поля');
      return;
    }

    try {
      setIsSavingLink(true);

      if (editingLink.id) {
        // Update
        const updated = await updateQuickLink(editingLink.id, {
          title: editingLink.title,
          icon: editingLink.icon,
          url: editingLink.url,
          order: editingLink.order,
          is_active: editingLink.is_active
        });
        setQuickLinks(prev => prev.map(l => l.id === updated.id ? updated : l));
      } else {
        // Create
        const created = await createQuickLink({
          title: editingLink.title!,
          icon: editingLink.icon!,
          url: editingLink.url!,
          order: editingLink.order || 1,
          is_active: editingLink.is_active !== false
        });
        setQuickLinks(prev => [...prev, created]);
      }

      closeLinkDrawer();
    } catch (error) {
      console.error('Error saving link:', error);
      alert('Ошибка при сохранении ссылки');
    } finally {
      setIsSavingLink(false);
    }
  };

  const toggleLinkActive = async (id: string, isActive: boolean) => {
    try {
      await updateQuickLink(id, { is_active: isActive });
      setQuickLinks(prev => prev.map(l => l.id === id ? { ...l, is_active: isActive } : l));
    } catch (error) {
      console.error('Error toggling link:', error);
    }
  };

  const confirmDeleteLink = (id: string) => {
    setLinkToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const executeDeleteLink = async () => {
    if (linkToDelete) {
      try {
        await deleteQuickLink(linkToDelete);
        setQuickLinks(prev => prev.filter(l => l.id !== linkToDelete));
        setIsDeleteModalOpen(false);
        setLinkToDelete(null);
      } catch (error) {
        console.error('Error deleting link:', error);
        alert('Ошибка при удалении ссылки');
      }
    }
  };

  // --- Drag and Drop for Quick Links ---

  const handleDragStart = (e: React.DragEvent, linkId: string) => {
    setDraggedLinkId(linkId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetLinkId: string) => {
    e.preventDefault();

    if (!draggedLinkId || draggedLinkId === targetLinkId) {
      setDraggedLinkId(null);
      return;
    }

    const newLinks = [...quickLinks];
    const draggedIndex = newLinks.findIndex(l => l.id === draggedLinkId);
    const targetIndex = newLinks.findIndex(l => l.id === targetLinkId);

    const [draggedLink] = newLinks.splice(draggedIndex, 1);
    newLinks.splice(targetIndex, 0, draggedLink);

    // Update order
    const reorderedLinks = newLinks.map((link, index) => ({
      ...link,
      order: index + 1
    }));

    setQuickLinks(reorderedLinks);

    try {
      await reorderQuickLinks(reorderedLinks.map(l => ({ id: l.id, order: l.order })));
    } catch (error) {
      console.error('Error reordering links:', error);
      loadData();
    }

    setDraggedLinkId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-8 md:py-12 pb-32 min-h-screen">
      <PageHeader
        title="Настройки дашборда"
        description="Управление настройками и быстрыми ссылками дашборда студентов"
      />

      <div className="max-w-4xl space-y-8">
        {/* General Settings */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-white/5">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6">
            Общие настройки
          </h3>

          <div className="space-y-6">
            {/* Greeting Template */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Текст приветствия
              </label>
              <Input
                value={settings.greeting_template}
                onChange={(e) => setSettings({ ...settings, greeting_template: e.target.value })}
                placeholder="Привет, {name}!"
              />
              <p className="text-xs text-zinc-500 mt-1">
                {'{name}'} заменяется на имя пользователя
              </p>
            </div>

            {/* No Calls Text */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Текст при отсутствии созвонов
              </label>
              <Input
                value={settings.no_calls_text}
                onChange={(e) => setSettings({ ...settings, no_calls_text: e.target.value })}
                placeholder="Нет запланированных созвонов"
              />
            </div>

            {/* Toggle Options */}
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  Показывать индикатор недели
                </span>
                <input
                  type="checkbox"
                  checked={settings.show_week_indicator}
                  onChange={(e) => setSettings({ ...settings, show_week_indicator: e.target.checked })}
                  className="w-5 h-5 text-violet-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  Показывать блок созвонов
                </span>
                <input
                  type="checkbox"
                  checked={settings.show_calls_block}
                  onChange={(e) => setSettings({ ...settings, show_calls_block: e.target.checked })}
                  className="w-5 h-5 text-violet-600 rounded"
                />
              </label>
            </div>
          </div>
        </section>

        {/* Week Settings */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <Calendar size={20} className="text-violet-600" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              Настройки недель
            </h3>
          </div>

          <div className="space-y-6">
            {/* Cohort Start Date */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Дата старта потока
              </label>
              <Input
                type="date"
                value={settings.cohort_start_date || ''}
                onChange={(e) => setSettings({ ...settings, cohort_start_date: e.target.value || null })}
              />
              <p className="text-xs text-zinc-500 mt-1">
                От этой даты рассчитывается текущая неделя
              </p>
            </div>

            {/* Week Duration */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Длительность недели (дней)
              </label>
              <Input
                type="number"
                min="1"
                value={settings.week_duration_days}
                onChange={(e) => setSettings({ ...settings, week_duration_days: parseInt(e.target.value) || 7 })}
              />
            </div>

            {/* Total Weeks */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Количество недель
              </label>
              <Input
                type="number"
                min="1"
                max="12"
                value={settings.total_weeks}
                onChange={(e) => setSettings({ ...settings, total_weeks: parseInt(e.target.value) || 4 })}
              />
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <LinkIcon size={20} className="text-violet-600" />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                Быстрые ссылки
              </h3>
            </div>

            <button
              onClick={openCreateLinkDrawer}
              disabled={quickLinks.length >= 6}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
              Добавить
            </button>
          </div>

          <div className="space-y-3">
            {quickLinks.length === 0 ? (
              <p className="text-center py-8 text-zinc-500">Нет быстрых ссылок</p>
            ) : (
              quickLinks
                .sort((a, b) => a.order - b.order)
                .map(link => (
                  <motion.div
                    key={link.id}
                    layout
                    draggable
                    onDragStart={(e) => handleDragStart(e as any, link.id)}
                    onDragOver={(e) => handleDragOver(e as any)}
                    onDrop={(e) => handleDrop(e as any, link.id)}
                    className={`group flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-move ${
                      draggedLinkId === link.id ? 'opacity-50' : ''
                    }`}
                  >
                    <GripVertical size={20} className="text-zinc-400" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-900 dark:text-white">
                          {link.title}
                        </span>
                        {!link.is_active && (
                          <span className="text-xs px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded">
                            Скрыта
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 truncate">{link.url}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleLinkActive(link.id, !link.is_active)}
                        className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 rounded-lg transition-colors"
                      >
                        {link.is_active ? <Eye size={18} /> : <EyeOff size={18} />}
                      </button>
                      <button
                        onClick={() => openEditLinkDrawer(link)}
                        className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 rounded-lg transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => confirmDeleteLink(link.id)}
                        className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))
            )}
          </div>

          {quickLinks.length > 0 && (
            <p className="text-xs text-zinc-500 mt-4">
              Максимум 6 ссылок. Используйте перетаскивание для изменения порядка.
            </p>
          )}
        </section>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            disabled={isSavingSettings}
            className="px-6 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {isSavingSettings ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Save size={20} />
                Сохранить настройки
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Link Editor Drawer */}
      <Drawer
        isOpen={isLinkEditorOpen}
        onClose={closeLinkDrawer}
        title={editingLink.id ? 'Редактировать ссылку' : 'Новая быстрая ссылка'}
      >
        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Название <span className="text-red-500">*</span>
            </label>
            <Input
              value={editingLink.title || ''}
              onChange={(e) => setEditingLink({ ...editingLink, title: e.target.value })}
              placeholder="Стили"
            />
          </div>

          {/* Icon */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Иконка <span className="text-red-500">*</span>
            </label>
            <select
              value={editingLink.icon || 'palette'}
              onChange={(e) => setEditingLink({ ...editingLink, icon: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {ICON_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Ссылка <span className="text-red-500">*</span>
            </label>
            <Input
              value={editingLink.url || ''}
              onChange={(e) => setEditingLink({ ...editingLink, url: e.target.value })}
              placeholder="/styles"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Относительная ссылка внутри платформы
            </p>
          </div>

          {/* Active */}
          <label className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
            <span className="text-sm font-medium text-zinc-900 dark:text-white">
              Активна
            </span>
            <input
              type="checkbox"
              checked={editingLink.is_active !== false}
              onChange={(e) => setEditingLink({ ...editingLink, is_active: e.target.checked })}
              className="w-5 h-5 text-violet-600 rounded"
            />
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={closeLinkDrawer}
              className="flex-1 px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium"
              disabled={isSavingLink}
            >
              Отмена
            </button>
            <button
              onClick={saveLink}
              disabled={isSavingLink || !editingLink.title || !editingLink.icon || !editingLink.url}
              className="flex-1 px-4 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingLink ? (
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
        onConfirm={executeDeleteLink}
        title="Удалить быструю ссылку?"
        message="Эта ссылка будет удалена из дашборда студентов."
      />
    </div>
  );
};

export default AdminDashboardSettings;
