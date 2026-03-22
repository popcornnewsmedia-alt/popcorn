import { cn } from "@/lib/utils";
import { useCategories } from "@/hooks/use-news";
import { Sparkles } from "lucide-react";

interface TopNavProps {
  selectedCategory?: string;
  onSelectCategory: (category?: string) => void;
}

export function TopNav({ selectedCategory, onSelectCategory }: TopNavProps) {
  const { data: categoryData } = useCategories();

  const categories = categoryData?.categories?.length
    ? categoryData.categories
    : ["Models", "Research", "Industry", "Policy", "Tools"];

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 glass-nav border-t border-white/20 shadow-[0_-4px_24px_rgba(25,28,27,0.08)] pb-safe">
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Logo mark */}
        <div className="flex-shrink-0 flex items-center gap-1.5 pr-3 border-r border-[#191c1b]/10">
          <div className="w-7 h-7 rounded-lg bg-[#191c1b] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Category pills — horizontal scroll */}
        <div className="flex-1 flex overflow-x-auto scrollbar-hide gap-2 snap-x">
          <button
            onClick={() => onSelectCategory(undefined)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all snap-start flex-shrink-0",
              !selectedCategory
                ? "bg-[#191c1b] text-[#e5e2e1]"
                : "bg-white/30 text-[#191c1b] hover:bg-white/50"
            )}
          >
            For You
          </button>

          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all snap-start flex-shrink-0",
                selectedCategory === cat
                  ? "bg-[#191c1b] text-[#e5e2e1]"
                  : "bg-white/30 text-[#191c1b] hover:bg-white/50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
