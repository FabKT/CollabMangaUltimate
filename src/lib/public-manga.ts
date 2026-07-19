import { CATALOG_MANGA, type CatalogManga } from "@/lib/haven-data";
import { loadStudioProjects } from "@/lib/studio-projects";

export type PublicChapter = {
  id: string;
  number: number;
  title: string;
  status: string;
  pages: {
    candidates: { id: string; image?: string }[];
    validatedCandidateId: string | null;
  }[];
};

export type PublicManga = CatalogManga & {
  subgenres: string[];
  chaptersList: PublicChapter[];
};

type StudioProject = {
  id: string;
  title: string;
  synopsis: string;
  status: string;
  genres: string[];
  subgenres?: string[];
  coverDataUrl?: string;
  catalogVisible?: boolean;
  chapters: PublicChapter[];
};

export async function loadPublicManga(id: string): Promise<PublicManga | null> {
  const projects = await loadStudioProjects<StudioProject>();
  const project = projects.find((item) => item.id === id && item.catalogVisible);
  if (project) {
    const published = project.chapters.filter((chapter) => chapter.status === "Published");
    return {
      id: project.id,
      title: project.title,
      creator: "CollabManga creator",
      cover: project.coverDataUrl ?? "",
      demographic: (["Shonen", "Seinen", "Shojo", "Josei"].includes(project.genres[0])
        ? project.genres[0]
        : "Shonen") as CatalogManga["demographic"],
      genres: project.genres,
      subgenres: project.subgenres ?? [],
      rating: 0,
      chapters: published.length,
      status: project.status,
      synopsis: project.synopsis,
      language: "FR",
      chaptersList: published,
    };
  }

  const catalogManga = CATALOG_MANGA.find((item) => item.id === id);
  return catalogManga
    ? { ...catalogManga, subgenres: catalogManga.genres, chaptersList: [] }
    : null;
}

export async function loadPublicChapter(mangaId: string, chapterId: string) {
  const manga = await loadPublicManga(mangaId);
  const chapter = manga?.chaptersList.find((item) => item.id === chapterId);
  if (!manga || !chapter) return null;

  const index = manga.chaptersList.findIndex((item) => item.id === chapterId);
  const images = chapter.pages
    .map((page) =>
      page.candidates.find((candidate) => candidate.id === page.validatedCandidateId)?.image,
    )
    .filter((image): image is string => Boolean(image));

  return {
    manga,
    chapter,
    images,
    previousId: index > 0 ? manga.chaptersList[index - 1].id : null,
    nextId: index < manga.chaptersList.length - 1 ? manga.chaptersList[index + 1].id : null,
  };
}
