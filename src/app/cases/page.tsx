import { Card, CardImage, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Stars } from "@/components/ui/stars"
import Link from "next/link"

const MOCK_CASES = [
  { id: "1", title: "130㎡现代简约风，三代同堂的温馨之家", designer: "张丽娜", style: "现代简约", area: 130, rating: 4.8, budget: 28 },
  { id: "2", title: "85㎡北欧风小户型，全屋收纳教科书", designer: "李明", style: "北欧风", area: 85, rating: 4.6, budget: 15 },
  { id: "3", title: "200㎡新中式别墅，东方美学的现代演绎", designer: "王思远", style: "新中式", area: 200, rating: 4.9, budget: 65 },
  { id: "4", title: "95㎡日式原木风，治愈系的温暖小家", designer: "陈薇", style: "日式", area: 95, rating: 4.7, budget: 18 },
  { id: "5", title: "150㎡轻奢风，精致生活的完美诠释", designer: "张丽娜", style: "轻奢", area: 150, rating: 4.8, budget: 45 },
  { id: "6", title: "60㎡老房改造，学区房的逆袭之路", designer: "李明", style: "混搭", area: 60, rating: 4.5, budget: 12 },
]

export default function CasesPage() {
  return (
    <div className="p-4">
      {/* 筛选栏 */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {["全部", "现代简约", "北欧风", "新中式", "日式", "轻奢", "混搭"].map((tag) => (
          <Badge key={tag} variant={tag === "全部" ? "default" : "secondary"} className="shrink-0 cursor-pointer">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {MOCK_CASES.map((item) => (
          <Link key={item.id} href={`/cases/${item.id}`}>
            <Card>
              <CardImage src="" alt={item.title} />
              <CardContent>
                <h3 className="text-sm font-medium line-clamp-1">{item.title}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                  <span>{item.designer}</span>
                  <span>·</span>
                  <span>{item.area}㎡</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <Stars rating={item.rating} size="sm" showValue />
                  <span className="text-xs text-zinc-400">{item.budget}w</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
