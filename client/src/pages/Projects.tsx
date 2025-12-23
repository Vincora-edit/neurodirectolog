import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsService } from '../services/api';
import type { Project } from '../services/api';
import { Plus, Edit, Trash2, FolderOpen, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function Projects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => projectsService.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const handleDelete = (projectId: string, projectName: string) => {
    if (confirm(`Удалить проект "${projectName}"?`)) {
      deleteMutation.mutate(projectId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600">Загрузка проектов...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Мои проекты</h1>
          <p className="mt-2 text-gray-600">
            Управляйте брифами и используйте их во всех модулях
          </p>
        </div>
        <button
          onClick={() => navigate('/projects/new')}
          className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-lg"
        >
          <Plus size={20} />
          Новый проект
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <FolderOpen size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            У вас пока нет проектов
          </h3>
          <p className="text-gray-600 mb-6">
            Создайте первый проект, чтобы начать работу с брифом
          </p>
          <button
            onClick={() => navigate('/projects/new')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={20} />
            Создать проект
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {projects.map((project: Project) => (
            <div
              key={project.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {project.name}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Calendar size={16} />
                      {format(new Date(project.createdAt), 'd MMMM yyyy', { locale: ru })}
                    </span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      {project.brief.niche}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/projects/${project.id}/edit`)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Редактировать"
                  >
                    <Edit size={20} />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id, project.name)}
                    disabled={deleteMutation.isPending}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Удалить"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Бизнес</p>
                  <p className="font-medium text-gray-900">{project.brief.businessName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Бюджет</p>
                  <p className="font-medium text-gray-900">
                    {project.brief.budget.total.toLocaleString('ru-RU')}₽ / {project.brief.budget.period}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-700 line-clamp-2">
                  {project.brief.businessDescription}
                </p>
              </div>

              {/* Module Status */}
              <div className="flex items-center gap-2 flex-wrap">
                {(project.hasSemantics || project.semantics) && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    ✓ Семантика
                  </span>
                )}
                {(project.hasCreatives || project.creatives) && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    ✓ Креативы
                  </span>
                )}
                {(project.hasAds || project.ads) && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    ✓ Объявления
                  </span>
                )}
                {(project.hasMinusWords || project.minusWords) && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    ✓ Минус-слова
                  </span>
                )}
                {(project.hasCampaigns || project.campaigns) && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    ✓ Кампании
                  </span>
                )}
                {(project.hasStrategy || project.strategy) && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    ✓ Стратегия
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
