
import React, { useState } from 'react';
import {
  Palette,
  Terminal,
  Book,
  GraduationCap,
  Edit,
  Plus,
  Trash2,
  Image as ImageIcon,
  Video,
  Upload,
  Save,
  Copy,
  GripVertical,
  Eye,
  CheckCircle2,
  Download,
  Map,
  ListOrdered,
  Clock,
  ChevronUp,
  ChevronDown,
  Link as LinkIcon,
  CloudUpload,
  Target
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { COURSE_MODULES, STYLES_DATA, PROMPTS_DATA, GLOSSARY_DATA, ROADMAPS_DATA, DASHBOARD_STAGES, SHOWCASE_DATA, PROMPT_CATEGORIES_DATA } from '../data';
import { Lesson, StyleCard, PromptItem, PromptCategoryItem, GlossaryTerm, CourseModule, Roadmap, RoadmapStep, DashboardStage, ShowcaseProject } from '../types';
import { Drawer, PageHeader, Input, Select, ConfirmModal, FileUploader } from '../components/Shared';
import { updateAppContent } from '../lib/supabase';

// Available colors for categories
const AVAILABLE_COLORS = [
  { value: 'indigo', label: 'Индиго', class: 'bg-indigo-500' },
  { value: 'violet', label: 'Фиолетовый', class: 'bg-violet-500' },
  { value: 'blue', label: 'Синий', class: 'bg-blue-500' },
  { value: 'pink', label: 'Розовый', class: 'bg-pink-500' },
  { value: 'red', label: 'Красный', class: 'bg-red-500' },
  { value: 'emerald', label: 'Изумрудный', class: 'bg-emerald-500' },
  { value: 'amber', label: 'Янтарный', class: 'bg-amber-500' },
  { value: 'cyan', label: 'Голубой', class: 'bg-cyan-500' },
  { value: 'green', label: 'Зелёный', class: 'bg-green-500' },
  { value: 'orange', label: 'Оранжевый', class: 'bg-orange-500' },
  { value: 'purple', label: 'Пурпурный', class: 'bg-purple-500' },
  { value: 'teal', label: 'Бирюзовый', class: 'bg-teal-500' },
];

// --- Types & Config ---

type ContentTab = 'lessons' | 'styles' | 'prompts' | 'glossary' | 'roadmaps' | 'stages';

// Extended Interfaces for Admin State (mocking DB fields)
interface AdminLesson extends Lesson {
  views: number;
  completions: number;
}

interface AdminStyle extends StyleCard {
  usageCount: number;
  status: 'published' | 'draft';
}

interface AdminPrompt extends PromptItem {
  copyCount: number;
  status: 'published' | 'draft';
}

interface AdminRoadmap extends Roadmap {
  activeUsers?: number;
  completions?: number;
}

// Helper to enrich data with admin fields (stable, no random)
const enrichStyles = (data: typeof STYLES_DATA): AdminStyle[] => data.map(s => ({
  ...s,
  usageCount: (s as any).usageCount ?? 0,
  status: (s as any).status ?? 'published'
} as AdminStyle));

const enrichPrompts = (data: typeof PROMPTS_DATA): AdminPrompt[] => data.map(p => ({
  ...p,
  copyCount: (p as any).copyCount ?? 0,
  status: (p as any).status ?? 'published'
} as AdminPrompt));

const enrichRoadmaps = (data: typeof ROADMAPS_DATA): AdminRoadmap[] => data.map(r => ({
  ...r,
  activeUsers: (r as any).activeUsers ?? 0,
  completions: (r as any).completions ?? 0
} as AdminRoadmap));

interface AdminContentProps {
    modules?: CourseModule[];
    onUpdateModules?: (modules: CourseModule[]) => void;
    prompts?: PromptItem[];
    onUpdatePrompts?: (prompts: PromptItem[]) => void;
    promptCategories?: PromptCategoryItem[];
    onUpdatePromptCategories?: (categories: PromptCategoryItem[]) => void;
    roadmaps?: Roadmap[];
    onUpdateRoadmaps?: (roadmaps: Roadmap[]) => void;
    styles?: StyleCard[];
    onUpdateStyles?: (styles: StyleCard[]) => void;
    glossary?: GlossaryTerm[];
    onUpdateGlossary?: (glossary: GlossaryTerm[]) => void;
    stages?: DashboardStage[];
    onUpdateStages?: (stages: DashboardStage[]) => void;
    showcase?: ShowcaseProject[];
    onUpdateShowcase?: (showcase: ShowcaseProject[]) => void;
}

const AdminContent: React.FC<AdminContentProps> = ({
    modules = COURSE_MODULES,
    onUpdateModules,
    prompts = PROMPTS_DATA,
    onUpdatePrompts,
    promptCategories = PROMPT_CATEGORIES_DATA,
    onUpdatePromptCategories,
    roadmaps = ROADMAPS_DATA,
    onUpdateRoadmaps,
    styles = STYLES_DATA,
    onUpdateStyles,
    glossary = GLOSSARY_DATA,
    onUpdateGlossary,
    stages = DASHBOARD_STAGES,
    onUpdateStages,
    showcase = SHOWCASE_DATA,
    onUpdateShowcase
}) => {
  // Enrich with admin fields for display
  const adminStyles = enrichStyles(styles);
  const adminPrompts = enrichPrompts(prompts);
  const adminRoadmaps = enrichRoadmaps(roadmaps);
  const [activeTab, setActiveTab] = useState<ContentTab>('lessons');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: ContentTab | 'modules' } | null>(null);

  // Category Management State
  const [customCategory, setCustomCategory] = useState<string>('');
  const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);
  const [isCategoryEditorOpen, setIsCategoryEditorOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PromptCategoryItem | null>(null);

  // Get sorted prompt categories
  const sortedPromptCategories = [...promptCategories].sort((a, b) => a.order - b.order);

  // Get unique categories from existing data + current editing item + stored categories
  const getUniqueCategories = (type: 'prompts' | 'roadmaps' | 'styles') => {
    let categories: string[] = [];

    if (type === 'prompts') {
      // Use stored categories, then add any custom ones from data
      const storedCategories = promptCategories.map(c => c.name);
      const dataCategories = prompts.map(p => p.category);
      categories = Array.from(new Set([...storedCategories, ...dataCategories]));
    } else if (type === 'roadmaps') {
      categories = Array.from(new Set(roadmaps.map(r => r.category)));
    } else if (type === 'styles') {
      categories = Array.from(new Set(styles.map(s => s.category)));
    }

    // Add current editing category if it's new and not empty
    if (editingItem?.category && !categories.includes(editingItem.category)) {
      categories.push(editingItem.category);
    }

    return categories.filter(c => c); // Remove empty strings
  };

  // Category CRUD handlers
  const handleAddCategory = () => {
    setEditingCategory({
      id: `cat-${Date.now()}`,
      name: '',
      icon: '📁',
      color: 'indigo',
      order: promptCategories.length + 1
    });
    setIsCategoryEditorOpen(true);
  };

  const handleEditCategory = (category: PromptCategoryItem) => {
    setEditingCategory({ ...category });
    setIsCategoryEditorOpen(true);
  };

  const handleSaveCategory = () => {
    if (!editingCategory || !editingCategory.name.trim()) return;

    const existingIndex = promptCategories.findIndex(c => c.id === editingCategory.id);
    let newCategories: PromptCategoryItem[];

    if (existingIndex >= 0) {
      // Update existing - also update prompts with old category name
      const oldName = promptCategories[existingIndex].name;
      const newName = editingCategory.name;

      if (oldName !== newName && onUpdatePrompts) {
        const updatedPrompts = prompts.map(p =>
          p.category === oldName ? { ...p, category: newName } : p
        );
        onUpdatePrompts(updatedPrompts);
      }

      newCategories = [...promptCategories];
      newCategories[existingIndex] = editingCategory;
    } else {
      // Add new
      newCategories = [...promptCategories, editingCategory];
    }

    if (onUpdatePromptCategories) {
      onUpdatePromptCategories(newCategories);
    }
    setIsCategoryEditorOpen(false);
    setEditingCategory(null);
  };

  const handleDeleteCategory = (categoryId: string) => {
    const category = promptCategories.find(c => c.id === categoryId);
    if (!category) return;

    // Check if any prompts use this category
    const promptsUsingCategory = prompts.filter(p => p.category === category.name);
    if (promptsUsingCategory.length > 0) {
      alert(`Невозможно удалить категорию "${category.name}" - она используется в ${promptsUsingCategory.length} промптах.`);
      return;
    }

    if (confirm(`Удалить категорию "${category.name}"?`)) {
      if (onUpdatePromptCategories) {
        onUpdatePromptCategories(promptCategories.filter(c => c.id !== categoryId));
      }
    }
  };

  const handleMoveCategory = (categoryId: string, direction: 'up' | 'down') => {
    const index = sortedPromptCategories.findIndex(c => c.id === categoryId);
    if (index < 0) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sortedPromptCategories.length) return;

    // Swap orders
    const newCategories = [...promptCategories];
    const catA = newCategories.find(c => c.id === sortedPromptCategories[index].id)!;
    const catB = newCategories.find(c => c.id === sortedPromptCategories[newIndex].id)!;

    const tempOrder = catA.order;
    catA.order = catB.order;
    catB.order = tempOrder;

    if (onUpdatePromptCategories) {
      onUpdatePromptCategories(newCategories);
    }
  };

  // --- Helpers ---

  const saveToCloud = async () => {
      if (!confirm('Вы уверены, что хотите сохранить все изменения в облако? Это обновит контент для всех студентов.')) return;

      setIsSaving(true);
      try {
          await Promise.all([
              updateAppContent('modules', modules),
              updateAppContent('prompts', prompts),
              updateAppContent('promptCategories', promptCategories),
              updateAppContent('roadmaps', roadmaps),
              updateAppContent('styles', styles),
              updateAppContent('glossary', glossary),
              updateAppContent('stages', stages),
              updateAppContent('showcase', showcase)
          ]);
          alert('Контент успешно сохранен в базе данных!');
      } catch (error) {
          console.error(error);
          alert('Ошибка при сохранении. Проверьте консоль.');
      } finally {
          setIsSaving(false);
      }
  };

  const confirmDelete = (id: string, type: ContentTab | 'modules') => {
      setItemToDelete({ id, type });
      setIsDeleteModalOpen(true);
  };

  const executeDelete = () => {
    if (!itemToDelete) return;
    const { id, type } = itemToDelete;

    if (type === 'modules' && onUpdateModules) {
        onUpdateModules(modules.filter(m => m.id !== id));
    }
    if (type === 'lessons' && onUpdateModules) {
        const newModules = modules.map(m => ({
            ...m,
            lessons: m.lessons.filter(l => l.id !== id)
        }));
        onUpdateModules(newModules);
    }
    if (type === 'styles' && onUpdateStyles) onUpdateStyles(styles.filter(i => i.id !== id));
    if (type === 'prompts' && onUpdatePrompts) onUpdatePrompts(prompts.filter(i => i.id !== id));
    if (type === 'glossary' && onUpdateGlossary) onUpdateGlossary(glossary.filter(i => i.id !== id));
    if (type === 'roadmaps' && onUpdateRoadmaps) onUpdateRoadmaps(roadmaps.filter(i => i.id !== id));
    if (type === 'stages' && onUpdateStages) onUpdateStages(stages.filter(s => s.id.toString() !== id));

    setIsDeleteModalOpen(false);
    setItemToDelete(null);
  };

  const openEditor = (item: any | null = null) => {
    // Reset category state when opening editor
    setIsAddingCategory(false);
    setCustomCategory('');

    if (!item) {
        if (activeTab === 'roadmaps') {
            setEditingItem({
                title: '',
                description: '',
                category: 'Подготовка',
                icon: '🚀',
                estimatedTime: '30 мин',
                difficulty: 'Легко',
                steps: []
            });
        } else if (activeTab === 'lessons') {
            setEditingItem({
                title: '',
                description: '',
                duration: '15 мин',
                moduleId: modules[0]?.id || '',
                videoUrl: '',
                status: 'draft',
                materials: [],
                tasks: []
            });
        } else if (activeTab === 'stages') {
            setEditingItem({
                id: Date.now(),
                title: '',
                subtitle: '',
                status: 'locked',
                tasks: []
            });
        } else if (activeTab === 'prompts') {
            setEditingItem({
                title: '',
                description: '',
                content: '',
                usage: '',
                category: 'Проектирование',
                tags: [],
                status: 'draft'
            });
        } else {
            setEditingItem({});
        }
    } else {
        setEditingItem({ ...item });
    }
    setIsEditorOpen(true);
  };

  const updateField = (field: string, value: any) => {
    setEditingItem((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    // Helper to add or update item in list
    const updateList = (list: any[], newItem: any) => {
        const index = list.findIndex(i => i.id === newItem.id);
        if (index >= 0) {
            const newList = [...list];
            newList[index] = { ...newList[index], ...newItem };
            return newList;
        } else {
            return [...list, { ...newItem, id: newItem.id || Date.now().toString() }];
        }
    };

    // Handle module creation/editing
    if (editingItem.isModule && onUpdateModules) {
        const newModule = {
            id: editingItem.id || Date.now().toString(),
            title: editingItem.title,
            description: editingItem.description,
            status: editingItem.status || 'available',
            lessons: editingItem.lessons || []
        };

        const existingIndex = modules.findIndex(m => m.id === newModule.id);
        if (existingIndex >= 0) {
            // Update existing module
            const updatedModules = [...modules];
            updatedModules[existingIndex] = { ...updatedModules[existingIndex], ...newModule };
            onUpdateModules(updatedModules);
        } else {
            // Add new module
            onUpdateModules([...modules, newModule]);
        }
        setIsEditorOpen(false);
        return;
    }

    if (activeTab === 'lessons' && onUpdateModules) {
        const newItem = { ...editingItem };
        const newModules = modules.map(mod => {
            const existingLessonIndex = mod.lessons.findIndex(l => l.id === newItem.id);
            if (existingLessonIndex >= 0) {
                if (newItem.moduleId && newItem.moduleId !== mod.id) {
                    return { ...mod, lessons: mod.lessons.filter(l => l.id !== newItem.id) };
                } else {
                    const updatedLessons = [...mod.lessons];
                    updatedLessons[existingLessonIndex] = { ...updatedLessons[existingLessonIndex], ...newItem };
                    return { ...mod, lessons: updatedLessons };
                }
            }
            if (mod.id === newItem.moduleId) {
                const lessonToAdd = {
                    ...newItem,
                    id: newItem.id || Date.now().toString(),
                    status: newItem.status || 'draft',
                    materials: newItem.materials || [],
                    tasks: newItem.tasks || []
                };
                return { ...mod, lessons: [...mod.lessons, lessonToAdd] };
            }
            return mod;
        });
        onUpdateModules(newModules);
    } else if (activeTab === 'styles' && onUpdateStyles) {
        onUpdateStyles(updateList(styles, editingItem));
    } else if (activeTab === 'prompts' && onUpdatePrompts) {
        onUpdatePrompts(updateList(prompts, editingItem));
    } else if (activeTab === 'roadmaps' && onUpdateRoadmaps) {
        onUpdateRoadmaps(updateList(roadmaps, editingItem));
    } else if (activeTab === 'glossary' && onUpdateGlossary) {
        onUpdateGlossary(updateList(glossary, editingItem));
    } else if (activeTab === 'stages' && onUpdateStages) {
        // For stages, we use numeric id
        const stageItem = { ...editingItem, id: editingItem.id || Date.now() };
        const index = stages.findIndex(s => s.id === stageItem.id);
        if (index >= 0) {
            const newStages = [...stages];
            newStages[index] = stageItem;
            onUpdateStages(newStages);
        } else {
            onUpdateStages([...stages, stageItem]);
        }
    }

    setIsEditorOpen(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingItem((prev: any) => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Render Functions ---

  const openModuleEditor = (module: CourseModule | null = null) => {
    if (!module) {
        setEditingItem({
            title: '',
            description: '',
            status: 'available',
            lessons: [],
            isModule: true
        });
    } else {
        setEditingItem({ ...module, isModule: true });
    }
    setIsEditorOpen(true);
  };

  const renderLessonsView = () => {
    // When reordering modules
    const handleReorderModules = (newOrder: CourseModule[]) => {
        if (onUpdateModules) onUpdateModules(newOrder);
    };

    // When reordering lessons inside a module
    const handleReorderLessons = (moduleId: string, newModuleLessons: Lesson[]) => {
        if (onUpdateModules) {
            const newModules = modules.map(m =>
                m.id === moduleId ? { ...m, lessons: newModuleLessons } : m
            );
            onUpdateModules(newModules);
        }
    };

    return (
      <>
      <div className="mb-6">
        <button
            onClick={() => openModuleEditor()}
            className="w-full py-4 border-2 border-dashed border-zinc-200 dark:border-white/10 rounded-2xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/20 transition-all flex items-center justify-center gap-2 font-bold text-sm bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
            <Plus size={18} />
            Добавить новый модуль
        </button>
      </div>
      <Reorder.Group axis="y" values={modules} onReorder={handleReorderModules} className="space-y-6">
        {modules.map((module) => {
            return (
              <Reorder.Item 
                key={module.id} 
                value={module}
                className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-white/5 overflow-hidden shadow-sm"
              >
                 <div className="bg-zinc-50 dark:bg-zinc-800/50 px-6 py-4 flex items-center justify-between border-b border-zinc-100 dark:border-white/5 cursor-grab active:cursor-grabbing group">
                    <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                       <div className="p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300 group-hover:bg-zinc-300 dark:group-hover:bg-zinc-600 transition-colors">
                         <GripVertical size={14} />
                       </div>
                       {module.title}
                    </h3>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md border border-zinc-200 dark:border-white/5">
                        {module.lessons.length} уроков
                        </span>
                        <button
                            onClick={() => openModuleEditor(module)}
                            className="p-1.5 text-zinc-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-lg transition-colors"
                            title="Редактировать модуль"
                        >
                            <Edit size={16} />
                        </button>
                        <button
                            onClick={() => confirmDelete(module.id, 'modules')}
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Удалить модуль"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                 </div>
                 
                 {/* Nested Lesson List */}
                 <Reorder.Group axis="y" values={module.lessons} onReorder={(newOrder) => handleReorderLessons(module.id, newOrder)} className="divide-y divide-zinc-100 dark:divide-white/5">
                    {module.lessons.map((lesson) => (
                       <Reorder.Item 
                            key={lesson.id} 
                            value={lesson}
                            className="group flex items-center gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors relative"
                       >
                          <div className="cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 p-2 -ml-2">
                             <GripVertical size={20} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate">{lesson.title}</h4>
                                {lesson.status === 'locked' && <span className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded">Draft</span>}
                                {lesson.status === 'completed' && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded">Live</span>}
                             </div>
                             <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                                <span className="flex items-center gap-1"><Video size={12} /> {lesson.duration}</span>
                                <span className="flex items-center gap-1"><Eye size={12} /> {(lesson as any).views || 0}</span>
                                {lesson.videoUrl && <span className="flex items-center gap-1 text-violet-500"><LinkIcon size={12} /> URL</span>}
                             </div>
                          </div>
    
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => openEditor(lesson)} className="p-2 rounded-lg text-zinc-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors">
                                <Edit size={16} />
                             </button>
                             <button onClick={() => confirmDelete(lesson.id, 'lessons')} className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                <Trash2 size={16} />
                             </button>
                          </div>
                       </Reorder.Item>
                    ))}
                 </Reorder.Group>
                 
                 <div className="bg-zinc-50 dark:bg-zinc-800/30 px-4 py-2 text-center">
                     <button onClick={() => openEditor({ moduleId: module.id })} className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline py-2 w-full">
                        + Добавить урок в модуль
                     </button>
                 </div>
              </Reorder.Item>
            );
        })}
      </Reorder.Group>
      </>
    );
  };

  const renderStylesView = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
         {adminStyles.map((style) => (
           <div key={style.id} className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-white/5 overflow-hidden group hover:border-violet-300 dark:hover:border-violet-500/30 transition-all shadow-sm">
              <div className="h-40 bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                 {style.image ? (
                    <img src={style.image} alt={style.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                 ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-700">
                        <ImageIcon size={32} />
                    </div>
                 )}
                 <div className="absolute top-3 right-3 flex gap-2">
                    <span className="px-2 py-1 rounded-full bg-black/50 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wider">
                       {style.category}
                    </span>
                 </div>
              </div>
              <div className="p-5">
                 <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{style.name}</h3>
                    <div className="flex gap-1">
                       <button onClick={() => openEditor(style)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white">
                          <Edit size={16} />
                       </button>
                       <button onClick={() => confirmDelete(style.id, 'styles')} className="p-1.5 rounded-lg text-zinc-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500">
                          <Trash2 size={16} />
                       </button>
                    </div>
                 </div>
                 <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                    <span className="flex items-center gap-1"><Copy size={12} /> {style.usageCount} копирований</span>
                    <span className={`px-1.5 py-0.5 rounded ${style.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}`}>
                       {style.status}
                    </span>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {style.tags?.map(tag => (
                       <span key={tag} className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400">#{tag}</span>
                    ))}
                 </div>
              </div>
           </div>
         ))}
      </div>
    );
  };

  const renderPromptsView = () => {
     return (
        <div className="space-y-8">
           {/* Categories Section */}
           <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-white/5 p-6">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Категории промптов</h3>
                 <button
                    onClick={handleAddCategory}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-500 transition-colors"
                 >
                    <Plus size={16} />
                    Добавить
                 </button>
              </div>
              <div className="space-y-2">
                 {sortedPromptCategories.map((category, index) => (
                    <div
                       key={category.id}
                       className="flex items-center gap-4 p-3 rounded-xl bg-zinc-50 dark:bg-white/5 group"
                    >
                       <div className="flex flex-col gap-1">
                          <button
                             onClick={() => handleMoveCategory(category.id, 'up')}
                             disabled={index === 0}
                             className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                             <ChevronUp size={14} />
                          </button>
                          <button
                             onClick={() => handleMoveCategory(category.id, 'down')}
                             disabled={index === sortedPromptCategories.length - 1}
                             className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                             <ChevronDown size={14} />
                          </button>
                       </div>
                       <span className="text-2xl">{category.icon}</span>
                       <div className="flex-1">
                          <span className="font-medium text-zinc-900 dark:text-white">{category.name}</span>
                          <span className="ml-2 text-xs text-zinc-400">
                             ({prompts.filter(p => p.category === category.name).length} промптов)
                          </span>
                       </div>
                       <div className={`w-6 h-6 rounded-full ${AVAILABLE_COLORS.find(c => c.value === category.color)?.class || 'bg-zinc-400'}`} />
                       <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                             onClick={() => handleEditCategory(category)}
                             className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                          >
                             <Edit size={16} />
                          </button>
                          <button
                             onClick={() => handleDeleteCategory(category.id)}
                             className="p-2 text-zinc-400 hover:text-red-500"
                          >
                             <Trash2 size={16} />
                          </button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           {/* Prompts Table */}
           <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-white/5 overflow-hidden">
              <table className="w-full text-left">
                 <thead className="bg-zinc-50 dark:bg-white/5 border-b border-zinc-200 dark:border-white/5">
                    <tr>
                       <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Категория</th>
                       <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Название</th>
                       <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Копирований</th>
                       <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Статус</th>
                       <th className="px-6 py-4 text-right"></th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                    {adminPrompts.map((prompt) => (
                       <tr key={prompt.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] group">
                          <td className="px-6 py-4">
                             <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-300">
                                {prompt.category}
                             </span>
                          </td>
                          <td className="px-6 py-4">
                             <div className="font-bold text-zinc-900 dark:text-white text-sm">{prompt.title}</div>
                             <div className="text-xs text-zinc-500 truncate max-w-[200px]">{prompt.description}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400 font-mono">
                             {prompt.copyCount}
                          </td>
                          <td className="px-6 py-4">
                             <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                prompt.status === 'published' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-100 text-amber-600'
                             }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${prompt.status === 'published' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                {prompt.status}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEditor(prompt)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><Edit size={16} /></button>
                                <button onClick={() => confirmDelete(prompt.id, 'prompts')} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 size={16} /></button>
                             </div>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>

           {/* Category Editor Modal */}
           <AnimatePresence>
              {isCategoryEditorOpen && editingCategory && (
                 <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
                    <motion.div
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       exit={{ opacity: 0 }}
                       onClick={() => setIsCategoryEditorOpen(false)}
                       className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                       initial={{ opacity: 0, scale: 0.95 }}
                       animate={{ opacity: 1, scale: 1 }}
                       exit={{ opacity: 0, scale: 0.95 }}
                       className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl"
                    >
                       <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-6">
                          {promptCategories.find(c => c.id === editingCategory.id) ? 'Редактировать категорию' : 'Новая категория'}
                       </h3>

                       <div className="space-y-4">
                          <div>
                             <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Название</label>
                             <input
                                type="text"
                                value={editingCategory.name}
                                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                                placeholder="Название категории..."
                                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500"
                             />
                          </div>

                          <div>
                             <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Иконка (эмодзи)</label>
                             <input
                                type="text"
                                value={editingCategory.icon}
                                onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                                placeholder="📋"
                                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500 text-2xl"
                             />
                          </div>

                          <div>
                             <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Цвет</label>
                             <div className="flex flex-wrap gap-2">
                                {AVAILABLE_COLORS.map(color => (
                                   <button
                                      key={color.value}
                                      onClick={() => setEditingCategory({ ...editingCategory, color: color.value })}
                                      className={`w-10 h-10 rounded-full ${color.class} ${
                                         editingCategory.color === color.value ? 'ring-2 ring-offset-2 ring-zinc-900 dark:ring-white' : ''
                                      }`}
                                      title={color.label}
                                   />
                                ))}
                             </div>
                          </div>
                       </div>

                       <div className="flex gap-3 mt-6">
                          <button
                             onClick={() => setIsCategoryEditorOpen(false)}
                             className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-white/10 font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5"
                          >
                             Отмена
                          </button>
                          <button
                             onClick={handleSaveCategory}
                             disabled={!editingCategory.name.trim()}
                             className="flex-1 px-4 py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                             Сохранить
                          </button>
                       </div>
                    </motion.div>
                 </div>
              )}
           </AnimatePresence>
        </div>
     );
  };

  const renderGlossaryView = () => {
    return (
       <div>
          <div className="flex gap-4 mb-6">
             <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors text-zinc-600 dark:text-zinc-300">
                <Upload size={16} /> Импорт CSV
             </button>
             <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors text-zinc-600 dark:text-zinc-300">
                <Download size={16} /> Экспорт CSV
             </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-white/5 overflow-hidden">
             <table className="w-full text-left">
                <thead className="bg-zinc-50 dark:bg-white/5 border-b border-zinc-200 dark:border-white/5">
                   <tr>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Термин</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Алиасы</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Категория</th>
                      <th className="px-6 py-4 text-right"></th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                   {glossary.map((term) => (
                      <tr key={term.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] group">
                         <td className="px-6 py-4">
                            <div className="font-bold text-zinc-900 dark:text-white text-sm">{term.term}</div>
                            <div className="text-xs text-zinc-500 truncate max-w-[300px]">{term.definition}</div>
                         </td>
                         <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400 italic">
                            {term.slang || '—'}
                         </td>
                         <td className="px-6 py-4">
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400">
                               {term.category}
                            </span>
                         </td>
                         <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button onClick={() => openEditor(term)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><Edit size={16} /></button>
                               <button onClick={() => confirmDelete(term.id, 'glossary')} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 size={16} /></button>
                            </div>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
       </div>
    );
  };

  const renderRoadmapsView = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminRoadmaps.map((map) => (
                <div key={map.id} className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-white/5 p-6 hover:border-violet-300 dark:hover:border-violet-500/30 transition-all shadow-sm group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-2xl">
                            {map.icon}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditor(map)} className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white">
                                <Edit size={16} />
                            </button>
                            <button onClick={() => confirmDelete(map.id, 'roadmaps')} className="p-2 rounded-lg text-zinc-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-white/10 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                {map.category}
                            </span>
                            <span className={`w-2 h-2 rounded-full ${map.difficulty === 'Легко' ? 'bg-emerald-500' : map.difficulty === 'Средне' ? 'bg-amber-500' : 'bg-red-500'}`} />
                        </div>
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-1">{map.title}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{map.description}</p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-white/5 text-xs text-zinc-500 dark:text-zinc-400">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1"><ListOrdered size={14} /> {map.steps.length} шагов</span>
                            <span className="flex items-center gap-1"><Clock size={14} /> {map.estimatedTime}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
  };

  const renderStagesView = () => {
    return (
        <div className="space-y-4">
            {stages.map((stage, index) => (
                <div key={stage.id} className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-white/5 p-6 hover:border-violet-300 dark:hover:border-violet-500/30 transition-all shadow-sm group">
                    <div className="flex items-start gap-4">
                        {/* Stage Number */}
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 ${
                            stage.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600' :
                            stage.status === 'current' ? 'bg-violet-100 dark:bg-violet-500/10 text-violet-600' :
                            'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                        }`}>
                            {index + 1}
                        </div>

                        {/* Stage Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{stage.title}</h3>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    stage.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600' :
                                    stage.status === 'current' ? 'bg-violet-100 dark:bg-violet-500/10 text-violet-600' :
                                    'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                                }`}>
                                    {stage.status === 'completed' ? 'Завершён' : stage.status === 'current' ? 'Текущий' : 'Закрыт'}
                                </span>
                            </div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">{stage.subtitle}</p>

                            {/* Tasks Preview */}
                            <div className="flex flex-wrap gap-2">
                                {stage.tasks.slice(0, 4).map(task => (
                                    <span key={task.id} className={`text-xs px-2 py-1 rounded-lg border ${
                                        task.completed
                                            ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 line-through'
                                            : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400'
                                    }`}>
                                        {task.title}
                                    </span>
                                ))}
                                {stage.tasks.length > 4 && (
                                    <span className="text-xs px-2 py-1 text-zinc-400">
                                        +{stage.tasks.length - 4} ещё
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => openEditor(stage)}
                                className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white"
                            >
                                <Edit size={16} />
                            </button>
                            <button
                                onClick={() => confirmDelete(stage.id.toString(), 'stages')}
                                className="p-2 rounded-lg text-zinc-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
  };

  const renderEditorForm = () => {
    // Dynamic form based on activeTab
    return (
      <div className="space-y-6">
         {/* Module Editor */}
         {editingItem?.isModule && (
            <>
               <Input
                  label="Название модуля"
                  placeholder="Введите название модуля..."
                  value={editingItem?.title || ''}
                  onChange={(e) => updateField('title', e.target.value)}
               />

               <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Описание модуля</label>
                  <textarea
                     rows={3}
                     value={editingItem?.description || ''}
                     onChange={(e) => updateField('description', e.target.value)}
                     placeholder="Краткое описание модуля..."
                     className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500"
                  />
               </div>

               <Select
                  label="Статус модуля"
                  value={editingItem?.status || 'available'}
                  onChange={(e) => updateField('status', e.target.value)}
                  options={[
                     { value: "available", label: "Доступен" },
                     { value: "locked", label: "Заблокирован" },
                     { value: "completed", label: "Завершён" }
                  ]}
               />
            </>
         )}

         {/* Common Name Field */}
         {!editingItem?.isModule && (
            <Input
               label={activeTab === 'glossary' ? 'Термин' : 'Название'}
               placeholder="Введите название..."
               value={editingItem?.title || editingItem?.name || editingItem?.term || ''}
               onChange={(e) => {
                   if (activeTab === 'glossary') updateField('term', e.target.value);
                   else if (activeTab === 'styles') updateField('name', e.target.value);
                   else updateField('title', e.target.value);
               }}
            />
         )}

         {/* Specific Fields */}
         {activeTab === 'lessons' && !editingItem?.isModule && (
            <>
               <div className="grid grid-cols-2 gap-4">
                  <Select 
                    label="Модуль"
                    value={editingItem?.moduleId || ''}
                    onChange={(e) => updateField('moduleId', e.target.value)}
                    options={[
                        { value: "", label: "Выберите модуль..." },
                        ...modules.map(m => ({ value: m.id, label: m.title }))
                    ]}
                  />
                  <Input 
                    label="Длительность"
                    value={editingItem?.duration || ''}
                    onChange={(e) => updateField('duration', e.target.value)}
                    placeholder="15 мин"
                  />
               </div>
               
               <Input 
                  label="Ссылка на видео (YouTube)"
                  icon={Video}
                  value={editingItem?.videoUrl || ''}
                  onChange={(e) => updateField('videoUrl', e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
               />

               <div>
                   <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Описание урока</label>
                   <textarea
                        rows={4}
                        value={editingItem?.description || ''}
                        onChange={(e) => updateField('description', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500"
                    />
               </div>

               {/* Materials Section */}
               <div className="pt-4 border-t border-zinc-200 dark:border-white/10">
                   <div className="flex items-center justify-between mb-3">
                       <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">Материалы урока</label>
                       <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">{(editingItem?.materials || []).length} материалов</span>
                   </div>

                   <div className="space-y-3">
                       {(editingItem?.materials || []).map((material: any, index: number) => (
                           <div key={material.id || index} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/5 relative group">
                               <div className="grid grid-cols-2 gap-3 mb-3">
                                   <input
                                       type="text"
                                       placeholder="Название материала"
                                       value={material.title || ''}
                                       onChange={(e) => {
                                           const newMaterials = [...(editingItem.materials || [])];
                                           newMaterials[index] = { ...material, title: e.target.value };
                                           updateField('materials', newMaterials);
                                       }}
                                       className="px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500 text-sm"
                                   />
                                   <select
                                       value={material.type || 'link'}
                                       onChange={(e) => {
                                           const newMaterials = [...(editingItem.materials || [])];
                                           newMaterials[index] = { ...material, type: e.target.value };
                                           updateField('materials', newMaterials);
                                       }}
                                       className="px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500 text-sm"
                                   >
                                       <option value="link">Ссылка</option>
                                       <option value="pdf">PDF</option>
                                       <option value="code">Код</option>
                                       <option value="figma">Figma</option>
                                   </select>
                               </div>
                               <input
                                   type="text"
                                   placeholder="URL материала"
                                   value={material.url || ''}
                                   onChange={(e) => {
                                       const newMaterials = [...(editingItem.materials || [])];
                                       newMaterials[index] = { ...material, url: e.target.value };
                                       updateField('materials', newMaterials);
                                   }}
                                   className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500 text-sm"
                               />
                               <button
                                   type="button"
                                   onClick={() => {
                                       const newMaterials = (editingItem.materials || []).filter((_: any, i: number) => i !== index);
                                       updateField('materials', newMaterials);
                                   }}
                                   className="absolute top-2 right-2 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                               >
                                   <Trash2 size={16} />
                               </button>
                           </div>
                       ))}

                       <button
                           type="button"
                           onClick={() => {
                               const newMaterial = {
                                   id: Date.now().toString(),
                                   title: '',
                                   type: 'link',
                                   url: ''
                               };
                               updateField('materials', [...(editingItem.materials || []), newMaterial]);
                           }}
                           className="w-full py-3 border-2 border-dashed border-zinc-200 dark:border-white/10 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/20 transition-all flex items-center justify-center gap-2 font-bold text-sm"
                       >
                           <Plus size={16} />
                           Добавить материал
                       </button>
                   </div>
               </div>

               {/* Tasks Section */}
               <div className="pt-4 border-t border-zinc-200 dark:border-white/10">
                   <div className="flex items-center justify-between mb-3">
                       <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">Задания урока</label>
                       <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">{(editingItem?.tasks || []).length} заданий</span>
                   </div>

                   <div className="space-y-3">
                       {(editingItem?.tasks || []).map((task: any, index: number) => (
                           <div key={task.id || index} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/5 relative group">
                               <div className="flex items-start gap-3">
                                   <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-300 shrink-0 mt-1">
                                       {index + 1}
                                   </div>
                                   <textarea
                                       rows={2}
                                       placeholder="Текст задания..."
                                       value={task.text || ''}
                                       onChange={(e) => {
                                           const newTasks = [...(editingItem.tasks || [])];
                                           newTasks[index] = { ...task, text: e.target.value };
                                           updateField('tasks', newTasks);
                                       }}
                                       className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500 text-sm resize-none"
                                   />
                                   <button
                                       type="button"
                                       onClick={() => {
                                           const newTasks = (editingItem.tasks || []).filter((_: any, i: number) => i !== index);
                                           updateField('tasks', newTasks);
                                       }}
                                       className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                                   >
                                       <Trash2 size={16} />
                                   </button>
                               </div>
                           </div>
                       ))}

                       <button
                           type="button"
                           onClick={() => {
                               const newTask = {
                                   id: Date.now().toString(),
                                   text: '',
                                   completed: false
                               };
                               updateField('tasks', [...(editingItem.tasks || []), newTask]);
                           }}
                           className="w-full py-3 border-2 border-dashed border-zinc-200 dark:border-white/10 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/20 transition-all flex items-center justify-center gap-2 font-bold text-sm"
                       >
                           <Plus size={16} />
                           Добавить задание
                       </button>
                   </div>
               </div>
            </>
         )}

         {activeTab === 'styles' && (
             <>
                <div>
                   <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Изображение обложки</label>
                   <div className="space-y-4">
                      {editingItem?.image && (
                          <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/10 group">
                              <img src={editingItem.image} className="w-full h-full object-cover" alt="Preview" />
                              <button 
                                onClick={() => updateField('image', '')}
                                className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                  <X size={16} />
                              </button>
                          </div>
                      )}
                      
                      {!editingItem?.image && (
                          <FileUploader 
                              onUpload={(url) => updateField('image', url)}
                              path="styles"
                              label="Загрузить обложку (JPG/PNG)"
                          />
                      )}

                      <Input 
                        label="Или вставьте прямую ссылку"
                        value={editingItem?.image || ''}
                        onChange={(e) => updateField('image', e.target.value)}
                        placeholder="https://..."
                      />
                   </div>
                </div>
                <div>
                   <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Промпт</label>
                   <textarea 
                        rows={6} 
                        value={editingItem?.prompt || ''}
                        onChange={(e) => updateField('prompt', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 font-mono text-sm" 
                    />
                </div>

                {/* Category Management for Styles */}
                <div>
                   <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Категория</label>
                   <div className="space-y-2">
                      <select
                         value={editingItem?.category || ''}
                         onChange={(e) => {
                            if (e.target.value === '__add_new__') {
                               setIsAddingCategory(true);
                            } else {
                               updateField('category', e.target.value);
                            }
                         }}
                         className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500"
                      >
                         <option value="">Выберите категорию...</option>
                         {getUniqueCategories('styles').map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                         ))}
                         <option value="__add_new__">+ Добавить новую категорию</option>
                      </select>

                      {isAddingCategory && (
                         <div className="flex gap-2">
                            <input
                               type="text"
                               placeholder="Новая категория..."
                               value={customCategory}
                               onChange={(e) => setCustomCategory(e.target.value)}
                               className="flex-1 px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500"
                               autoFocus
                            />
                            <button
                               type="button"
                               onClick={() => {
                                  if (customCategory.trim()) {
                                     updateField('category', customCategory.trim());
                                     setCustomCategory('');
                                     setIsAddingCategory(false);
                                  }
                               }}
                               className="px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-500 font-bold text-sm"
                            >
                               Добавить
                            </button>
                            <button
                               type="button"
                               onClick={() => {
                                  setIsAddingCategory(false);
                                  setCustomCategory('');
                               }}
                               className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-300 dark:hover:bg-zinc-600 font-bold text-sm"
                            >
                               Отмена
                            </button>
                         </div>
                      )}
                   </div>
                </div>
             </>
         )}

         {activeTab === 'prompts' && (
            <>
               <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Текст промпта</label>
                  <textarea
                       rows={8}
                       value={editingItem?.content || ''}
                       onChange={(e) => updateField('content', e.target.value)}
                       placeholder="Введите текст промпта..."
                       className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500 font-mono text-sm"
                   />
               </div>

               <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Инструкция по использованию</label>
                  <textarea
                       rows={3}
                       value={editingItem?.usage || ''}
                       onChange={(e) => updateField('usage', e.target.value)}
                       placeholder="Как использовать этот промпт..."
                       className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500 text-sm"
                   />
               </div>

               {/* Category Management for Prompts */}
               <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Категория</label>
                  <div className="space-y-2">
                     <select
                        value={editingItem?.category || ''}
                        onChange={(e) => {
                           if (e.target.value === '__add_new__') {
                              setIsAddingCategory(true);
                           } else {
                              updateField('category', e.target.value);
                           }
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500"
                     >
                        <option value="">Выберите категорию...</option>
                        {getUniqueCategories('prompts').map(cat => (
                           <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="__add_new__">+ Добавить новую категорию</option>
                     </select>

                     {isAddingCategory && (
                        <div className="flex gap-2">
                           <input
                              type="text"
                              placeholder="Новая категория..."
                              value={customCategory}
                              onChange={(e) => setCustomCategory(e.target.value)}
                              className="flex-1 px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500"
                              autoFocus
                           />
                           <button
                              type="button"
                              onClick={() => {
                                 if (customCategory.trim()) {
                                    updateField('category', customCategory.trim());
                                    setCustomCategory('');
                                    setIsAddingCategory(false);
                                 }
                              }}
                              className="px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-500 font-bold text-sm"
                           >
                              Добавить
                           </button>
                           <button
                              type="button"
                              onClick={() => {
                                 setIsAddingCategory(false);
                                 setCustomCategory('');
                              }}
                              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-300 dark:hover:bg-zinc-600 font-bold text-sm"
                           >
                              Отмена
                           </button>
                        </div>
                     )}
                  </div>
               </div>

               <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Теги (через запятую)</label>
                  <input
                     type="text"
                     value={(editingItem?.tags || []).join(', ')}
                     onChange={(e) => updateField('tags', e.target.value.split(',').map((t: string) => t.trim()).filter((t: string) => t))}
                     placeholder="react, typescript, ui..."
                     className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500"
                  />
               </div>
            </>
         )}

         {activeTab === 'glossary' && (
            <>
               <Input 
                  label="Синонимы (Сленг)"
                  value={editingItem?.slang || ''}
                  onChange={(e) => updateField('slang', e.target.value)}
                  placeholder="Например: Деплой, выкатка..."
               />
               <Select 
                  label="Категория"
                  value={editingItem?.category || 'Базовые'}
                  onChange={(e) => updateField('category', e.target.value)}
                  options={['Базовые', 'Код', 'Инструменты', 'API', 'Ошибки', 'Вайб-кодинг'].map(c => ({ value: c, label: c }))}
               />
               <div>
                   <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Определение</label>
                   <textarea 
                        rows={4} 
                        value={editingItem?.definition || ''}
                        onChange={(e) => updateField('definition', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500" 
                    />
               </div>
            </>
         )}

         {activeTab === 'roadmaps' && (
            <>
                <div className="grid grid-cols-2 gap-4">
                    {/* Category Management for Roadmaps */}
                    <div>
                       <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Категория</label>
                       <div className="space-y-2">
                          <select
                             value={editingItem?.category || ''}
                             onChange={(e) => {
                                if (e.target.value === '__add_new__') {
                                   setIsAddingCategory(true);
                                } else {
                                   updateField('category', e.target.value);
                                }
                             }}
                             className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500"
                          >
                             <option value="">Выберите категорию...</option>
                             {getUniqueCategories('roadmaps').map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                             ))}
                             <option value="__add_new__">+ Добавить новую</option>
                          </select>

                          {isAddingCategory && (
                             <div className="flex gap-2">
                                <input
                                   type="text"
                                   placeholder="Новая категория..."
                                   value={customCategory}
                                   onChange={(e) => setCustomCategory(e.target.value)}
                                   className="flex-1 px-3 py-2 text-sm rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500"
                                   autoFocus
                                />
                                <button
                                   type="button"
                                   onClick={() => {
                                      if (customCategory.trim()) {
                                         updateField('category', customCategory.trim());
                                         setCustomCategory('');
                                         setIsAddingCategory(false);
                                      }
                                   }}
                                   className="px-3 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-500 font-bold text-xs"
                                >
                                   OK
                                </button>
                                <button
                                   type="button"
                                   onClick={() => {
                                      setIsAddingCategory(false);
                                      setCustomCategory('');
                                   }}
                                   className="px-3 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-300 dark:hover:bg-zinc-600 font-bold text-xs"
                                >
                                   ✕
                                </button>
                             </div>
                          )}
                       </div>
                    </div>
                    <Input 
                        label="Иконка (Эмодзи)"
                        value={editingItem?.icon || ''}
                        onChange={(e) => updateField('icon', e.target.value)}
                        placeholder="🚀"
                        className="text-center"
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <Select 
                        label="Сложность"
                        value={editingItem?.difficulty || 'Легко'}
                        onChange={(e) => updateField('difficulty', e.target.value)}
                        options={[
                            { value: "Легко", label: "Легко" },
                            { value: "Средне", label: "Средне" },
                            { value: "Сложно", label: "Сложно" }
                        ]}
                    />
                    <Input 
                        label="Время"
                        value={editingItem?.estimatedTime || ''}
                        onChange={(e) => updateField('estimatedTime', e.target.value)}
                        placeholder="30 мин"
                    />
                </div>

                <div>
                   <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Описание</label>
                   <textarea 
                        rows={3} 
                        value={editingItem?.description || ''}
                        onChange={(e) => updateField('description', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500" 
                    />
               </div>

               {/* Visual Steps Editor */}
               <div className="pt-2">
                   <div className="flex items-center justify-between mb-3">
                       <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">Шаги дорожной карты</label>
                       <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">{(editingItem?.steps || []).length} шагов</span>
                   </div>
                   
                   <div className="space-y-3">
                       {/* List of Steps */}
                       {(editingItem?.steps || []).map((step: RoadmapStep, index: number) => (
                           <div key={step.id || index} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/5 relative group">
                               {/* Row 1: Order & Title */}
                               <div className="flex items-center gap-3 mb-3">
                                   <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-300 shrink-0">
                                       {index + 1}
                                   </div>
                                   <input 
                                       type="text" 
                                       placeholder="Название шага"
                                       value={step.title}
                                       onChange={(e) => {
                                           const newSteps = [...editingItem.steps];
                                           newSteps[index] = { ...step, title: e.target.value };
                                           updateField('steps', newSteps);
                                       }}
                                       className="flex-1 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-violet-500 focus:outline-none px-2 py-1 font-medium transition-colors"
                                   />
                                   
                                   {/* Actions */}
                                   <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                       <button 
                                           type="button"
                                           onClick={() => {
                                               if (index > 0) {
                                                   const newSteps = [...editingItem.steps];
                                                   [newSteps[index], newSteps[index - 1]] = [newSteps[index - 1], newSteps[index]];
                                                   updateField('steps', newSteps);
                                               }
                                           }}
                                           className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-500 disabled:opacity-30"
                                           disabled={index === 0}
                                       >
                                           <ChevronUp size={16} />
                                       </button>
                                       <button 
                                           type="button"
                                           onClick={() => {
                                               if (index < editingItem.steps.length - 1) {
                                                   const newSteps = [...editingItem.steps];
                                                   [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
                                                   updateField('steps', newSteps);
                                               }
                                           }}
                                           className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-500 disabled:opacity-30"
                                           disabled={index === editingItem.steps.length - 1}
                                       >
                                           <ChevronDown size={16} />
                                       </button>
                                       <button 
                                           type="button"
                                           onClick={() => {
                                               const newSteps = editingItem.steps.filter((_: any, i: number) => i !== index);
                                               updateField('steps', newSteps);
                                           }}
                                           className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-zinc-400 hover:text-red-500 ml-1"
                                       >
                                           <Trash2 size={16} />
                                       </button>
                                   </div>
                               </div>

                               {/* Row 2: Description */}
                               <div className="mb-3 pl-9">
                                   <textarea 
                                       rows={2}
                                       placeholder="Описание действия..."
                                       value={step.description}
                                       onChange={(e) => {
                                           const newSteps = [...editingItem.steps];
                                           newSteps[index] = { ...step, description: e.target.value };
                                           updateField('steps', newSteps);
                                       }}
                                       className="w-full bg-white dark:bg-zinc-900/50 rounded-lg p-2 text-sm border border-zinc-200 dark:border-white/5 focus:outline-none focus:border-violet-500/50"
                                   />
                               </div>

                               {/* Row 3: Links */}
                               <div className="pl-9 flex gap-2">
                                   <div className="flex-1 flex items-center gap-2 bg-white dark:bg-zinc-900/50 rounded-lg px-2 border border-zinc-200 dark:border-white/5 focus-within:border-violet-500/50">
                                       <LinkIcon size={14} className="text-zinc-400" />
                                       <input 
                                           type="text" 
                                           placeholder="https://..."
                                           value={step.linkUrl || ''}
                                           onChange={(e) => {
                                               const newSteps = [...editingItem.steps];
                                               newSteps[index] = { ...step, linkUrl: e.target.value };
                                               updateField('steps', newSteps);
                                           }}
                                           className="flex-1 bg-transparent py-1.5 text-xs focus:outline-none"
                                       />
                                   </div>
                                   <div className="flex-1 flex items-center gap-2 bg-white dark:bg-zinc-900/50 rounded-lg px-2 border border-zinc-200 dark:border-white/5 focus-within:border-violet-500/50">
                                       <span className="text-xs font-bold text-zinc-400">Текст:</span>
                                       <input 
                                           type="text" 
                                           placeholder="Например: Скачать VS Code"
                                           value={step.linkText || ''}
                                           onChange={(e) => {
                                               const newSteps = [...editingItem.steps];
                                               newSteps[index] = { ...step, linkText: e.target.value };
                                               updateField('steps', newSteps);
                                           }}
                                           className="flex-1 bg-transparent py-1.5 text-xs focus:outline-none"
                                       />
                                   </div>
                               </div>
                           </div>
                       ))}

                       {/* Add Button */}
                       <button
                           type="button"
                           onClick={() => {
                               const newStep = {
                                   id: Date.now().toString(),
                                   title: '',
                                   description: '',
                                   linkUrl: '',
                                   linkText: ''
                               };
                               updateField('steps', [...(editingItem.steps || []), newStep]);
                           }}
                           className="w-full py-3 border-2 border-dashed border-zinc-200 dark:border-white/10 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/20 transition-all flex items-center justify-center gap-2 font-bold text-sm"
                       >
                           <Plus size={16} />
                           Добавить шаг
                       </button>
                   </div>
               </div>
            </>
         )}

         {activeTab === 'stages' && (
            <>
               <Input
                  label="Название этапа"
                  placeholder="Например: Основы веб-разработки"
                  value={editingItem?.title || ''}
                  onChange={(e) => updateField('title', e.target.value)}
               />

               <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Подзаголовок</label>
                  <textarea
                     rows={2}
                     value={editingItem?.subtitle || ''}
                     onChange={(e) => updateField('subtitle', e.target.value)}
                     placeholder="Краткое описание этапа..."
                     className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 focus:outline-none focus:border-violet-500"
                  />
               </div>

               <Select
                  label="Статус этапа"
                  value={editingItem?.status || 'locked'}
                  onChange={(e) => updateField('status', e.target.value)}
                  options={[
                     { value: "locked", label: "Закрыт" },
                     { value: "current", label: "Текущий" },
                     { value: "completed", label: "Завершён" }
                  ]}
               />

               {/* Stage Tasks Editor */}
               <div className="pt-4 border-t border-zinc-200 dark:border-white/10">
                   <div className="flex items-center justify-between mb-3">
                       <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">Задачи этапа</label>
                       <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">{(editingItem?.tasks || []).length} задач</span>
                   </div>

                   <div className="space-y-3">
                       {(editingItem?.tasks || []).map((task: any, index: number) => (
                           <div key={task.id || index} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/5 relative group">
                               <div className="flex items-center gap-3">
                                   {/* Checkbox for completed */}
                                   <button
                                       type="button"
                                       onClick={() => {
                                           const newTasks = [...(editingItem.tasks || [])];
                                           newTasks[index] = { ...task, completed: !task.completed };
                                           updateField('tasks', newTasks);
                                       }}
                                       className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                                           task.completed
                                               ? 'bg-emerald-500 border-emerald-500 text-white'
                                               : 'border-zinc-300 dark:border-zinc-600 hover:border-emerald-400'
                                       }`}
                                   >
                                       {task.completed && <CheckCircle2 size={12} />}
                                   </button>

                                   {/* Task title input */}
                                   <input
                                       type="text"
                                       placeholder="Название задачи..."
                                       value={task.title || ''}
                                       onChange={(e) => {
                                           const newTasks = [...(editingItem.tasks || [])];
                                           newTasks[index] = { ...task, title: e.target.value };
                                           updateField('tasks', newTasks);
                                       }}
                                       className={`flex-1 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-violet-500 focus:outline-none px-2 py-1 font-medium transition-colors ${
                                           task.completed ? 'line-through text-zinc-400' : ''
                                       }`}
                                   />

                                   {/* Move up/down */}
                                   <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                       <button
                                           type="button"
                                           onClick={() => {
                                               if (index > 0) {
                                                   const newTasks = [...(editingItem.tasks || [])];
                                                   [newTasks[index], newTasks[index - 1]] = [newTasks[index - 1], newTasks[index]];
                                                   updateField('tasks', newTasks);
                                               }
                                           }}
                                           className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-500 disabled:opacity-30"
                                           disabled={index === 0}
                                       >
                                           <ChevronUp size={16} />
                                       </button>
                                       <button
                                           type="button"
                                           onClick={() => {
                                               if (index < (editingItem.tasks || []).length - 1) {
                                                   const newTasks = [...(editingItem.tasks || [])];
                                                   [newTasks[index], newTasks[index + 1]] = [newTasks[index + 1], newTasks[index]];
                                                   updateField('tasks', newTasks);
                                               }
                                           }}
                                           className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-500 disabled:opacity-30"
                                           disabled={index === (editingItem.tasks || []).length - 1}
                                       >
                                           <ChevronDown size={16} />
                                       </button>
                                       <button
                                           type="button"
                                           onClick={() => {
                                               const newTasks = (editingItem.tasks || []).filter((_: any, i: number) => i !== index);
                                               updateField('tasks', newTasks);
                                           }}
                                           className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-zinc-400 hover:text-red-500 ml-1"
                                       >
                                           <Trash2 size={16} />
                                       </button>
                                   </div>
                               </div>
                           </div>
                       ))}

                       {/* Add Task Button */}
                       <button
                           type="button"
                           onClick={() => {
                               const newTask = {
                                   id: 't' + Date.now().toString(),
                                   title: '',
                                   completed: false
                               };
                               updateField('tasks', [...(editingItem.tasks || []), newTask]);
                           }}
                           className="w-full py-3 border-2 border-dashed border-zinc-200 dark:border-white/10 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/20 transition-all flex items-center justify-center gap-2 font-bold text-sm"
                       >
                           <Plus size={16} />
                           Добавить задачу
                       </button>
                   </div>
               </div>
            </>
         )}

         {/* Common Status (Available for Lessons, Styles, Prompts) */}
         {activeTab !== 'glossary' && activeTab !== 'roadmaps' && activeTab !== 'stages' && !editingItem?.isModule && (
            <div className="pt-4 border-t border-zinc-100 dark:border-white/5">
                <Select
                    label="Статус"
                    value={editingItem?.status || 'published'}
                    onChange={(e) => updateField('status', e.target.value)}
                    options={[
                        { value: "published", label: "Опубликован" },
                        { value: "draft", label: "Черновик" },
                        { value: "hidden", label: "Скрыт" }
                    ]}
                />
            </div>
         )}
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-8 md:py-12 pb-32">
       {/* Top Bar */}
       <PageHeader
         title="Управление контентом"
         description="Редактирование базы знаний платформы."
         action={
            <div className="flex items-center gap-3">
               <button
                onClick={saveToCloud}
                disabled={isSaving}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                <CloudUpload size={18} />
                <span>{isSaving ? 'Сохраняем...' : 'Сохранить в облако'}</span>
               </button>
               <button
                onClick={() => openEditor()}
                className="px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-zinc-500/10"
               >
                <Plus size={18} />
                <span>Добавить {activeTab === 'lessons' ? 'урок' : activeTab === 'styles' ? 'стиль' : activeTab === 'prompts' ? 'промпт' : activeTab === 'roadmaps' ? 'карту' : activeTab === 'stages' ? 'этап' : 'термин'}</span>
               </button>
            </div>
         }
       />

       {/* Tabs Navigation */}
       <div className="flex overflow-x-auto scrollbar-none gap-2 mb-8 bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-2xl w-full md:w-fit border border-zinc-200 dark:border-white/5">
          {[
             { id: 'lessons', label: 'Уроки', icon: GraduationCap },
             { id: 'roadmaps', label: 'Карты', icon: Map },
             { id: 'stages', label: 'Этапы', icon: Target },
             { id: 'styles', label: 'Стили', icon: Palette },
             { id: 'prompts', label: 'Промпты', icon: Terminal },
             { id: 'glossary', label: 'Словарь', icon: Book },
          ].map((tab) => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as ContentTab)}
               className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
               }`}
             >
                <tab.icon size={16} className={activeTab === tab.id ? "text-violet-600 dark:text-violet-400" : ""} />
                {tab.label}
             </button>
          ))}
       </div>

       {/* Main Content Area */}
       <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
       >
          {activeTab === 'lessons' && renderLessonsView()}
          {activeTab === 'styles' && renderStylesView()}
          {activeTab === 'prompts' && renderPromptsView()}
          {activeTab === 'glossary' && renderGlossaryView()}
          {activeTab === 'roadmaps' && renderRoadmapsView()}
          {activeTab === 'stages' && renderStagesView()}
       </motion.div>

       {/* Edit Panel Drawer */}
       <Drawer
         isOpen={isEditorOpen}
         onClose={() => setIsEditorOpen(false)}
         title={`${editingItem?.id ? 'Редактировать' : 'Создать'} ${
            editingItem?.isModule ? 'модуль' :
            activeTab === 'lessons' ? 'урок' :
            activeTab === 'roadmaps' ? 'карту' :
            activeTab === 'stages' ? 'этап' :
            activeTab === 'styles' ? 'стиль' :
            activeTab === 'prompts' ? 'промпт' :
            activeTab === 'glossary' ? 'термин' : 'запись'
         }`}
         footer={
            <>
                <button 
                    type="button" 
                    onClick={() => setIsEditorOpen(false)}
                    className="px-6 py-3 rounded-xl border border-zinc-200 dark:border-white/10 font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                >
                    Отмена
                </button>
                <button 
                    type="submit" 
                    form="edit-form"
                    className="px-6 py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-500 transition-colors shadow-lg shadow-violet-500/20 flex items-center gap-2"
                >
                    <Save size={18} />
                    Сохранить
                </button>
            </>
         }
       >
          <form id="edit-form" onSubmit={handleSave}>
             {renderEditorForm()}
          </form>
       </Drawer>

       {/* Delete Confirmation */}
       <ConfirmModal 
         isOpen={isDeleteModalOpen}
         onClose={() => setIsDeleteModalOpen(false)}
         onConfirm={executeDelete}
       />

    </div>
  );
};

export default AdminContent;
