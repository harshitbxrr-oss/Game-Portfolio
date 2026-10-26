// ============================================================
// PORTFOLIO CONTENT — edit this object to update the whole site.
// Every panel, hologram, departure board and the Quick view read from here.
// Text in [square brackets] is a placeholder for you to replace.
// ============================================================
const PORTFOLIO = {
  profile: {
    name: 'Harshit Kumar Sinha',
    role: 'UI/UX Designer',
    tagline: 'I design products end to end, then build them in code.',
    photo: '' // optional: paste an image URL or data URI
  },
  about: {
    paragraphs: [
      'Hi, my name is **Harshit**. I care about building clear, useful, and considered digital products.',
      "I'm a UI/UX designer working across mobile and web, focused on the space where user research, interaction design, and visual craft meet. I like turning an early idea into an experience that feels calm, obvious, and intentional.",
      "My process is hands-on: understand the problem, map the structure, design the details, and keep testing until the interface holds up under real use. I value clean systems, honest feedback, and interfaces that don't need a manual.",
      "Outside of screens, I pay attention to the small things — type pairing, spacing rhythm, motion timing — the details that make a product feel designed rather than assembled."
    ],
    tags: [
      { name: 'UI Design', type: 'blue' },
      { name: 'UX Research', type: 'blue' },
      { name: 'Design Systems', type: 'amber' },
      { name: 'Prototyping', type: 'neutral' }
    ]
  },
  skills: [
    {
      category: 'DESIGN TOOLS',
      items: [
        { name: 'Figma', tag: 'Interface Design', icon: 'figma' },
        { name: 'Adobe XD', tag: 'Interface Design', icon: 'xd' },
        { name: 'Sketch', tag: 'Interface Design', icon: 'sketch' },
        { name: 'Photoshop', tag: 'Visual Design', icon: 'ps' },
        { name: 'Illustrator', tag: 'Visual Design', icon: 'ai' },
        { name: 'Framer', tag: 'Prototyping', icon: 'framer' }
      ]
    },
    {
      category: 'UX PROCESS',
      items: [
        { name: 'Wireframing', tag: 'UX Process', icon: 'wireframe' },
        { name: 'Prototyping', tag: 'UX Process', icon: 'prototype' },
        { name: 'User Research', tag: 'UX Process', icon: 'research' },
        { name: 'Usability Testing', tag: 'UX Process', icon: 'testing' }
      ]
    },
    {
      category: 'SYSTEMS & COLLABORATION',
      items: [
        { name: 'Design Systems', tag: 'Systems', icon: 'systems' },
        { name: 'Design Tokens', tag: 'Systems', icon: 'tokens' },
        { name: 'Dev Handoff', tag: 'Collaboration', icon: 'handoff' },
        { name: 'Notion', tag: 'Collaboration', icon: 'notion' }
      ]
    },
    {
      category: 'CORE CONCEPTS',
      items: [
        { name: 'Information Architecture', tag: 'Concepts', icon: 'ia' },
        { name: 'Interaction Design', tag: 'Concepts', icon: 'interaction' },
        { name: 'Accessibility', tag: 'WCAG 2.1', icon: 'a11y' },
        { name: 'Design Thinking', tag: 'Concepts', icon: 'thinking' }
      ]
    }
  ],
  caseStudies: [
    {
      title: 'WallVista',
      summary: 'Visualise wall designs in your space, compare verified pros and book with confidence.',
      role: 'Product Designer (Solo UX/UI)',
      duration: '8 weeks',
      cover: 'case-studies/wallvista/wallvista-cover.png',
      coverAlt: 'WallVista 3D wall-design preview in a living room',
      problem: 'Visualisation, pricing, professional discovery and booking live in different places. Homeowners are left to connect the dots and take all the risk before knowing what it will actually look like or cost.',
      process: [
        'Researched 3 behavioural personas (The Curator, First-Timer, Renter) to address confidence gaps',
        'Mapped the 5-stage homeowner flow: Discover → Visualise → Compare → Book → Complete',
        'Designed 13 interactive moments transitioning from wireframes to high-fidelity mobile UI',
        'Defined AI-assisted wall analysis, AR/3D design preview, transparent quotes and protected booking'
      ],
      outcome: [
        'Visualisation-first architecture: start with the room before matching with pros, eliminating commitment anxiety',
        'Transparent marketplace: clear cost breakdowns, verified ratings and milestone-based protected payment'
      ],
      accent: '#6366F1',
      link: 'case-studies/wallvista/index.html?from=game'
    },
    {
      title: 'Home Tutor Pro',
      summary: 'Home tutor discovery platform focused on helping learners and families discover suitable home tutors.',
      role: 'UI/UX Designer',
      duration: 'Case Study',
      problem: 'Finding reliable home tutors is fragmented, lacking structured discovery, verified qualifications, and transparent pricing for parents and students.',
      process: [
        'Conducted user research to identify key trust factors and onboarding friction for families',
        'Structured search, subject filters, verified credentials, and trial booking flows',
        'Designed high-fidelity mobile experience focused on trust, ratings, and transparent fees'
      ],
      outcome: [
        'Designed an intuitive discovery path making tutor search and booking straightforward',
        'Created verified tutor profiles with clear subject specializations and scheduling'
      ],
      accent: '#EC4899',
      link: '#'
    },
    {
      title: '3D Game Portfolio',
      summary: 'Interactive 3D portfolio experience presenting personal design work in an exploratory 3D world.',
      role: 'Product Designer & Creative Developer',
      duration: 'Featured Project',
      cover: 'assets/images/ref-07-holo-interchange.jpg',
      problem: 'Traditional portfolios are static and passive. Designers need innovative ways to demonstrate interaction design, systems thinking, and execution.',
      process: [
        'Concepted Shatranj City: blending Indian architectural heritage with cyberpunk vehicle exploration',
        'Designed telemetry HUD, interactive quest checkpoints, and rich landmark content cards',
        'Built with WebGL2 shaders, responsive controls, and accessible 2D Quick View fallback'
      ],
      outcome: [
        'Created a game-inspired portfolio experience presenting personal work in an interactive 3D environment',
        'Implemented dual-mode access: full 3D driving experience plus accessible portfolio page'
      ],
      accent: '#10B981',
      link: '#'
    }
  ],
  resume: {
    summary: 'UI/UX design learner with a Bachelor of Arts in Political Science (Honours), currently pursuing the UI/UX Leadership Program at IIM Skills. Interested in creating clear, user-centred digital experiences through research, wireframing, interaction design, and visual design.',
    experience: [
      {
        company: 'Wall Vista',
        role: 'UI/UX Designer (Project)',
        start: '2026',
        end: 'Present',
        bullets: [
          'Concept for helping homeowners explore wall colours, designs, and wall art through visualisation on their own walls.',
          'Connects the visualisation journey with verified painters and wall artists, with an emphasis on transparent pricing.'
        ]
      },
      {
        company: 'Home Tutor Pro',
        role: 'UI/UX Designer (Project)',
        start: '2026',
        end: '2026',
        bullets: [
          'Product concept focused on helping learners and families discover suitable home tutors.',
          'Designed around making tutor discovery and the path to connecting with a tutor easier to navigate.'
        ]
      },
      {
        company: 'My Game Portfolio',
        role: 'Web Portfolio & 3D Interactive Design',
        start: '2026',
        end: '2026',
        bullets: [
          'Created a game-inspired portfolio experience to present personal work in an interactive 3D environment.',
          'Integrated Indian cultural aesthetics with futuristic cyber-city exploration, real-time lighting, and vehicle physics.'
        ]
      }
    ],
    education: [
      {
        school: 'IIM Skills',
        degree: 'UI/UX Leadership Program',
        years: 'June 2026 – October 2026 (ongoing)'
      },
      {
        school: 'Veer Kunwar Singh University, Arrah',
        degree: 'Bachelor of Arts (Political Science) (Honours)',
        years: '2020 – 2023'
      }
    ],
    pdfUrl: 'assets/harshit-kumar-sinha-resume.pdf'
  },
  contact: {
    email: 'harshitbxrr@gmail.com',
    phone: '+91 7654882962',
    location: 'Prayagraj, Uttar Pradesh',
    links: [
      { label: 'LinkedIn', url: 'https://linkedin.com' },
      { label: 'Behance', url: 'https://behance.net' },
      { label: 'Resume (PDF)', url: 'assets/harshit-kumar-sinha-resume.pdf' }
    ]
  }
};
