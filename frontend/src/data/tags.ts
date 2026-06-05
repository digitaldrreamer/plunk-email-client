export interface Tag {
  id: string;
  name: string;
  color: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
}

export const TAGS: Tag[] = [
  {
    id: "work",
    name: "Work",
    color: "blue",
    bgClass: "bg-blue-100 dark:bg-blue-950/40",
    textClass: "text-blue-700 dark:text-blue-400",
    dotClass: "bg-blue-500",
  },
  {
    id: "personal",
    name: "Personal",
    color: "green",
    bgClass: "bg-green-100 dark:bg-green-950/40",
    textClass: "text-green-700 dark:text-green-400",
    dotClass: "bg-green-500",
  },
  {
    id: "finance",
    name: "Finance",
    color: "orange",
    bgClass: "bg-orange-100 dark:bg-orange-950/40",
    textClass: "text-orange-700 dark:text-orange-400",
    dotClass: "bg-orange-500",
  },
  {
    id: "important",
    name: "Important",
    color: "red",
    bgClass: "bg-red-100 dark:bg-red-950/40",
    textClass: "text-red-700 dark:text-red-400",
    dotClass: "bg-red-500",
  },
  {
    id: "travel",
    name: "Travel",
    color: "cyan",
    bgClass: "bg-cyan-100 dark:bg-cyan-950/40",
    textClass: "text-cyan-700 dark:text-cyan-400",
    dotClass: "bg-cyan-500",
  },
  {
    id: "product",
    name: "Product",
    color: "purple",
    bgClass: "bg-purple-100 dark:bg-purple-950/40",
    textClass: "text-purple-700 dark:text-purple-400",
    dotClass: "bg-purple-500",
  },
  {
    id: "design",
    name: "Design",
    color: "pink",
    bgClass: "bg-pink-100 dark:bg-pink-950/40",
    textClass: "text-pink-700 dark:text-pink-400",
    dotClass: "bg-pink-500",
  },
  {
    id: "legal",
    name: "Legal",
    color: "yellow",
    bgClass: "bg-yellow-100 dark:bg-yellow-950/40",
    textClass: "text-yellow-700 dark:text-yellow-400",
    dotClass: "bg-yellow-500",
  },
];

export function getTag(id: string) {
  return TAGS.find((t) => t.id === id);
}
