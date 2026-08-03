import type { PromptEntryData } from "@/lib/content/types";

export const seedPrompts: PromptEntryData[] = [
  {
    slug: "tesla-fsd-infographic",
    title: "特斯拉 FSD 工作原理图解",
    author: {
      name: "@Ananto Mohammad",
      url: "https://x.com/01Ananto",
    },
    sourceUrl: "https://x.com/01Ananto/status/1991747192005202004",
    images: [
      {
        alt: "特斯拉 FSD 工作原理图解",
        src: "/images/prompts/tesla-fsd-infographic-1.jpg",
        objectKey: "prompts/tesla-fsd-infographic/1.webp",
        width: 2048,
        height: 1118,
      },
    ],
    prompt: "Make an infographic that explains how Tesla FSD works",
  },
  {
    slug: "egg-carving-grandmother",
    title: "宝玉老师灵感下的蛋雕艺术",
    author: {
      name: "@两斤",
      url: "https://x.com/0x00_Krypt",
    },
    sourceUrl: "https://x.com/0x00_Krypt/status/2000463000231440553",
    images: [
      {
        alt: "暖光下雕刻着祖母编织场景的蛋雕艺术",
        src: "/images/prompts/egg-carving-grandmother-1.jpg",
        objectKey: "prompts/egg-carving-grandmother/1.webp",
        width: 2816,
        height: 1536,
      },
    ],
    prompt: `Inspired by the delicate art of egg carving, intricately depict a grandmother sitting in a rocking chair knitting by a window through elaborate hollow cutouts on a single, complete duck egg shell.

All carved elements are organically connected by thin, delicate shell bridges and lattice structures to maintain structural integrity, ensuring no isolated or floating segments.

The shell surface has a smooth, matte white texture. Gentle, warm backlighting illuminates the shell from within, creating a translucent glow around the cutouts and cozy silhouettes.

Background features a softly blurred rustic living room with a fireplace, providing a nostalgic and warm atmosphere, captured in ultra-detailed 8K resolution for macro-level realism, showing every tiny chisel mark.`,
  },
  {
    slug: "high-end-fashion-cover",
    title: "高端时尚杂志封面",
    author: {
      name: "@Latte",
      url: "https://x.com/0xbisc",
    },
    sourceUrl: "https://x.com/0xbisc/status/2005178390765338864",
    images: [1, 2, 3].map((position) => ({
      alt: `高端时尚杂志封面示例 ${position}`,
      src: `/images/prompts/high-end-fashion-cover-${position}.jpg`,
      objectKey: `prompts/high-end-fashion-cover/${position}.webp`,
      width: 896,
      height: 1200,
    })),
    prompt:
      "一张高端时尚杂志封面。{年轻女性时尚模特}，气质自信前卫，身体张力强，动态姿态，直视镜头。镜头为略低机位仰拍。模特双手比起取景框手势，仿佛与一个矩形选中框有互动，选中框覆盖脸部和肩部。视觉规则：只有选中框内部清晰且为自然彩色；选中框外完全灰度强像素化，无任何颜色或清晰区域。柔和漫射棚拍光。现代编辑感穿搭。版式文字：顶部居中粗体大写扁宽型无衬线标题“FOCUS”，上方小字“DECEMBER 2025”；标题左下“VOL + 随机两位数”；左下角文字块（简短时尚自信标题、短段落、条形码）；右侧“FASHION INTERVIEW”；右下角衬线体小号“THE EDIT”及大号“01-09的随机数字”。模特对标题有遮挡叠加，前后景关系，层次分明，干净现代。字体均为白色，蒙太奇风格字体，文字与图像形成强烈对比。",
  },
];
