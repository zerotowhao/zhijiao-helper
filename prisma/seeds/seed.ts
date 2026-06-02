import { PrismaClient } from "../../app/generated/prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import bcrypt from "bcryptjs"

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
})

const prisma = new PrismaClient({ adapter })

// 高中生物完整知识点体系
// 必修一 / 必修二 / 选择性必修一 / 选择性必修二 / 选择性必修三
const BIOLOGY_KNOWLEDGE_POINTS: {
  module: string
  book: string
  points: string[]
}[] = [
  {
    book: "必修一",
    module: "走进细胞",
    points: [
      "细胞是生命活动的基本单位",
      "细胞的多样性与统一性",
      "使用高倍显微镜观察细胞",
    ],
  },
  {
    book: "必修一",
    module: "组成细胞的分子",
    points: [
      "细胞中的元素和化合物",
      "细胞中的无机物",
      "细胞中的糖类和脂质",
      "蛋白质是生命活动的主要承担者",
      "核酸是遗传信息的携带者",
    ],
  },
  {
    book: "必修一",
    module: "细胞的基本结构",
    points: [
      "细胞膜的结构和功能",
      "细胞器之间的分工合作",
      "细胞核的结构和功能",
    ],
  },
  {
    book: "必修一",
    module: "细胞的物质输入和输出",
    points: [
      "被动运输",
      "主动运输与胞吞胞吐",
    ],
  },
  {
    book: "必修一",
    module: "细胞的能量供应和利用",
    points: [
      "降低化学反应活化能的酶",
      "细胞的能量货币ATP",
      "细胞呼吸的原理和应用",
      "光合作用与能量转化",
    ],
  },
  {
    book: "必修一",
    module: "细胞的生命历程",
    points: [
      "细胞的增殖",
      "细胞的分化",
      "细胞的衰老和死亡",
    ],
  },
  // ─── 必修二 ───────────────────────────
  {
    book: "必修二",
    module: "遗传因子的发现",
    points: [
      "孟德尔的豌豆杂交实验（一）",
      "孟德尔的豌豆杂交实验（二）",
      "分离定律",
      "自由组合定律",
    ],
  },
  {
    book: "必修二",
    module: "基因和染色体的关系",
    points: [
      "减数分裂",
      "受精作用",
      "基因在染色体上",
      "伴性遗传",
    ],
  },
  {
    book: "必修二",
    module: "基因的本质",
    points: [
      "DNA是主要的遗传物质",
      "DNA的结构",
      "DNA的复制",
      "基因通常是有遗传效应的DNA片段",
    ],
  },
  {
    book: "必修二",
    module: "基因的表达",
    points: [
      "基因指导蛋白质的合成",
      "基因表达与性状的关系",
      "中心法则",
    ],
  },
  {
    book: "必修二",
    module: "基因突变及其他变异",
    points: [
      "基因突变",
      "基因重组",
      "染色体变异",
      "人类遗传病",
    ],
  },
  {
    book: "必修二",
    module: "生物的进化",
    points: [
      "生物有共同祖先的证据",
      "自然选择与适应的形成",
      "种群基因组成的变化与物种的形成",
      "协同进化与生物多样性的形成",
    ],
  },
  // ─── 选择性必修一 ──────────────────────
  {
    book: "选择性必修一",
    module: "人体的内环境与稳态",
    points: [
      "细胞生活的环境",
      "内环境的稳态",
    ],
  },
  {
    book: "选择性必修一",
    module: "神经调节",
    points: [
      "神经调节的结构基础",
      "神经调节的基本方式",
      "神经冲动的产生和传导",
      "神经系统的分级调节",
      "人脑的高级功能",
    ],
  },
  {
    book: "选择性必修一",
    module: "体液调节",
    points: [
      "激素与内分泌系统",
      "激素调节的过程",
      "体液调节与神经调节的关系",
    ],
  },
  {
    book: "选择性必修一",
    module: "免疫调节",
    points: [
      "免疫系统的组成和功能",
      "特异性免疫",
      "免疫失调",
      "免疫学的应用",
    ],
  },
  {
    book: "选择性必修一",
    module: "植物生命活动的调节",
    points: [
      "植物生长素",
      "其他植物激素",
      "植物生长调节剂的应用",
      "环境因素参与调节植物的生命活动",
    ],
  },
  // ─── 选择性必修二 ──────────────────────
  {
    book: "选择性必修二",
    module: "种群及其动态",
    points: [
      "种群的数量特征",
      "种群数量的变化",
      "影响种群数量变化的因素",
    ],
  },
  {
    book: "选择性必修二",
    module: "群落及其演替",
    points: [
      "群落的结构",
      "群落的主要类型",
      "群落的演替",
    ],
  },
  {
    book: "选择性必修二",
    module: "生态系统及其稳定性",
    points: [
      "生态系统的结构",
      "生态系统的能量流动",
      "生态系统的物质循环",
      "生态系统的信息传递",
      "生态系统的稳定性",
    ],
  },
  {
    book: "选择性必修二",
    module: "人与环境",
    points: [
      "人类活动对生态环境的影响",
      "生物多样性及其保护",
      "生态工程",
    ],
  },
  // ─── 选择性必修三 ──────────────────────
  {
    book: "选择性必修三",
    module: "发酵工程",
    points: [
      "传统发酵技术的应用",
      "微生物的培养技术及应用",
      "发酵工程及其应用",
    ],
  },
  {
    book: "选择性必修三",
    module: "细胞工程",
    points: [
      "植物细胞工程",
      "动物细胞工程",
      "胚胎工程",
    ],
  },
  {
    book: "选择性必修三",
    module: "基因工程",
    points: [
      "重组DNA技术的基本工具",
      "基因工程的基本操作程序",
      "基因工程的应用",
      "蛋白质工程的原理和应用",
    ],
  },
  {
    book: "选择性必修三",
    module: "生物技术的安全性与伦理问题",
    points: [
      "转基因产品的安全性",
      "关注生殖性克隆人",
      "禁止生物武器",
    ],
  },
]

async function main() {
  console.log("🌱 开始初始化数据库...\n")

  // ─── 1. Create demo teacher ─────────────────────
  const teacherRawPassword = process.env.SEED_TEACHER_PASSWORD || "Teacher@2026!"
  const teacherPassword = await bcrypt.hash(teacherRawPassword, 12)
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@zhijiao.com" },
    update: {},
    create: {
      name: "王老师",
      email: "teacher@zhijiao.com",
      passwordHash: teacherPassword,
      role: "TEACHER",
    },
  })
  console.log(`✅ 教师账号: teacher@zhijiao.com / ${teacherRawPassword}`)

  // ─── 2. Create demo class ───────────────────────
  const class1 = await prisma.class.create({
    data: {
      name: "高一(3)班",
      grade: "高一",
    },
  })
  console.log("✅ 班级: 高一(3)班")

  // ─── 3. Create demo students ────────────────────
  const studentRawPassword = process.env.SEED_STUDENT_PASSWORD || "Student@2026!"
  const studentPassword = await bcrypt.hash(studentRawPassword, 12)
  const studentNames = [
    "张三", "李四", "王五", "赵六", "陈七",
    "刘八", "杨九", "周十", "吴一", "郑二",
  ]
  for (let i = 0; i < studentNames.length; i++) {
    const studentNumber = String(100001 + i)
    await prisma.user.upsert({
      where: { studentNumber },
      update: {},
      create: {
        name: studentNames[i],
        studentNumber,
        passwordHash: studentPassword,
        role: "STUDENT",
        classId: class1.id,
      },
    })
  }
  console.log(`✅ ${studentNames.length} 名学生 (学号 100001-1000${studentNames.length - 1})`)

  // ─── 4. Create knowledge points ─────────────────
  let kpCount = 0
  for (const module of BIOLOGY_KNOWLEDGE_POINTS) {
    // Create parent module
    const parent = await prisma.knowledgePoint.upsert({
      where: {
        book_module_name: {
          book: module.book,
          module: module.module,
          name: module.module,
        },
      },
      update: {},
      create: {
        name: module.module,
        book: module.book,
        module: module.module,
        sortOrder: 0,
      },
    })

    // Create child knowledge points
    for (let i = 0; i < module.points.length; i++) {
      await prisma.knowledgePoint.upsert({
        where: {
          book_module_name: {
            book: module.book,
            module: module.module,
            name: module.points[i],
          },
        },
        update: {},
        create: {
          name: module.points[i],
          book: module.book,
          module: module.module,
          parentId: parent.id,
          sortOrder: i + 1,
        },
      })
      kpCount++
    }
  }
  console.log(`✅ ${BIOLOGY_KNOWLEDGE_POINTS.length} 个知识模块, ${kpCount} 个知识点`)

  // ─── 5. Create sample questions ─────────────────
  const sampleQuestions = [
    {
      content: "下列关于光合作用的叙述，正确的是（　）",
      answer: "D",
      explanation:
        "光合作用的光反应阶段在类囊体薄膜上进行，产生ATP和[H]；暗反应阶段在叶绿体基质中进行，消耗ATP和[H]。光反应为暗反应提供ATP和[H]。",
      questionType: "CHOICE" as const,
      difficulty: "MEDIUM" as const,
      options: [
        { label: "A", text: "光反应产生的ATP只用于暗反应" },
        { label: "B", text: "暗反应可以在无光条件下长期进行" },
        {
          label: "C",
          text: "光合作用释放的O₂全部来自于CO₂",
        },
        {
          label: "D",
          text: "光反应为暗反应提供ATP和NADPH",
        },
      ],
      kpName: "光合作用与能量转化",
    },
    {
      content: "DNA分子复制的特点是（　）",
      answer: "C",
      explanation:
        "DNA复制是半保留复制，以解开的每一条母链为模板，按照碱基互补配对原则合成新的子链。",
      questionType: "CHOICE" as const,
      difficulty: "EASY" as const,
      options: [
        { label: "A", text: "全保留复制" },
        { label: "B", text: "分散复制" },
        { label: "C", text: "半保留复制" },
        { label: "D", text: "半不连续复制" },
      ],
      kpName: "DNA的复制",
    },
    {
      content: "减数分裂过程中，同源染色体分离发生在（　）",
      answer: "B",
      explanation:
        "减数第一次分裂后期（减Ⅰ后期），同源染色体分开，分别移向细胞两极。",
      questionType: "CHOICE" as const,
      difficulty: "MEDIUM" as const,
      options: [
        { label: "A", text: "减Ⅰ前期" },
        { label: "B", text: "减Ⅰ后期" },
        { label: "C", text: "减Ⅱ前期" },
        { label: "D", text: "减Ⅱ后期" },
      ],
      kpName: "减数分裂",
    },
    {
      content:
        "细胞呼吸过程中，葡萄糖分解为丙酮酸的阶段称为______，该阶段发生在______中。",
      answer: "糖酵解；细胞质基质",
      explanation:
        "糖酵解（EMP途径）在细胞质基质中进行，将1分子葡萄糖分解为2分子丙酮酸，净产生2分子ATP和2分子NADH。",
      questionType: "FILL_IN_BLANK" as const,
      difficulty: "EASY" as const,
      kpName: "细胞呼吸的原理和应用",
    },
    {
      content:
        "请简述特异性免疫中体液免疫的基本过程。",
      answer:
        "抗原呈递细胞（如树突状细胞）摄取、处理抗原后呈递给辅助性T细胞；辅助性T细胞激活B细胞；B细胞增殖分化为浆细胞和记忆B细胞；浆细胞分泌特异性抗体与抗原结合，形成沉淀或细胞集团，最终被吞噬细胞清除。",
      explanation:
        "体液免疫的三个关键阶段：抗原呈递→T细胞与B细胞协同→抗体产生与清除。记忆B细胞保留在体内，再次遇到相同抗原时迅速应答（二次免疫）。",
      questionType: "SHORT_ANSWER" as const,
      difficulty: "HARD" as const,
      kpName: "特异性免疫",
    },
  ]

  for (const q of sampleQuestions) {
    // Find the knowledge point
    const kp = await prisma.knowledgePoint.findFirst({
      where: { name: q.kpName },
    })
    if (!kp) {
      console.log(`⚠️  跳过题目: 找不到知识点 "${q.kpName}"`)
      continue
    }

    const question = await prisma.question.create({
      data: {
        content: q.content,
        answer: q.answer,
        explanation: q.explanation,
        questionType: q.questionType,
        difficulty: q.difficulty,
        options: q.options || undefined,
        source: "manual",
      },
    })

    await prisma.knowledgePointOnQuestion.create({
      data: {
        questionId: question.id,
        knowledgePointId: kp.id,
      },
    })
  }
  console.log(`✅ ${sampleQuestions.length} 道示例题目`)

  console.log("\n🎉 数据库初始化完成！")
  console.log(`   教师登录: teacher@zhijiao.com / ${teacherRawPassword}`)
  console.log(`   学生登录: 100001 / ${studentRawPassword}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
