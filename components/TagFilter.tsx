type TagFilterProps = {
  categories: readonly string[];
  activeCategory: string;
  onSelect: (category: string) => void;
};

export default function TagFilter({
  categories,
  activeCategory,
  onSelect,
}: TagFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {categories.map((category) => {
        const isActive = category === activeCategory;
        return (
          <button
            key={category}
            type="button"
            onClick={() => onSelect(category)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-[#1d1d1f] text-white"
                : "bg-white text-[#515154] ring-1 ring-[#e5e5ea] hover:bg-[#f5f5f7]"
            }`}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}
