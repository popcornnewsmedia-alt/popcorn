import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useCategories } from "@/hooks/use-news";
import { Sparkles } from "lucide-react";

interface TopNavProps {
  selectedCategory?: string;
  onSelectCategory: (category?: string) => void;
}

export function TopNav({ selectedCategory, onSelectCategory }: TopNavProps) {
  const { data: categoryData } = useCategories();
  const [scrolled, setScrolled] = useState(false);

  // Fallback categories if API fails or is empty
  const categories = categoryData?.categories?.length 
    ? categoryData.categories 
    : ["Models", "Research", "Industry", "Policy", "Tools", "Startups"];

  return (
    <div className="fixed top-0 inset-x-0 z-40 bg-gradient-to-b from-black/80 via-black/40 to-transparent pt-safe pb-6 pointer-events-none">
      <div className="px-4 sm:px-6 flex flex-col gap-4 pointer-events-auto">
        {/* Brand Header */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white tracking-widest uppercase text-shadow-sm">
              Pulse
            </h1>
          </div>
        </div>

        {/* Categories */}
        <div className="flex overflow-x-auto scrollbar-hide -mx-4 px-4 sm:-mx-6 sm:px-6 gap-2 snap-x">
          <button
            onClick={() => onSelectCategory(undefined)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all backdrop-blur-md border snap-start",
              !selectedCategory 
                ? "bg-white text-black border-white" 
                : "bg-black/30 text-white border-white/20 hover:bg-black/50"
            )}
          >
            For You
          </button>
          
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all backdrop-blur-md border snap-start",
                selectedCategory === cat
                  ? "bg-white text-black border-white" 
                  : "bg-black/30 text-white border-white/20 hover:bg-black/50"
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
