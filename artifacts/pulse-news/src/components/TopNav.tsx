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

  const categories = categoryData?.categories?.length 
    ? categoryData.categories 
    : ["Models", "Research", "Industry", "Policy", "Tools", "Startups"];

  return (
    <div className="fixed top-0 inset-x-0 z-40 glass-panel border-b border-white/30 shadow-[0_4px_20px_rgba(25,28,27,0.06)] pt-safe pb-4">
      <div className="px-4 sm:px-6 flex flex-col gap-4">
        {/* Brand Header */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#191c1b] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold text-[#191c1b] tracking-widest uppercase">
              Pulse
            </h1>
          </div>
        </div>

        {/* Categories */}
        <div className="flex overflow-x-auto scrollbar-hide -mx-4 px-4 sm:-mx-6 sm:px-6 gap-2 snap-x pb-2">
          <button
            onClick={() => onSelectCategory(undefined)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border snap-start",
              !selectedCategory 
                ? "bg-[#191c1b] text-[#e5e2e1] border-transparent" 
                : "bg-white/50 text-[#474747] border-[#c6c6c6]/30 hover:bg-white/80"
            )}
          >
            For You
          </button>
          
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border snap-start",
                selectedCategory === cat
                  ? "bg-[#191c1b] text-[#e5e2e1] border-transparent" 
                  : "bg-white/50 text-[#474747] border-[#c6c6c6]/30 hover:bg-white/80"
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