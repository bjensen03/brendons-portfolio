import { CONTACT } from '../../config';

/*
  Recommendations from my LinkedIn profile. They are public, visible to
  all LinkedIn members. Every quote is verbatim: spelling and punctuation are
  exactly as written. Text may be trimmed with "…" but never reworded.

  `quote` is the full recommendation, with paragraphs separated by a blank
  line. `short` is one or two sentences for the homepage carousel, which
  shows all of them, in this order (2026-10-25: Kaylee's moved
  there from About so the recommendations are together).
*/

export type Testimonial = {
  /** One or two sentences, verbatim, trimmed only with "…". */
  short: string;
  /** The full recommendation, verbatim. Paragraphs separated by "\n\n". */
  quote: string;
  name: string;
  /** Their headline on LinkedIn when they wrote it. */
  title: string;
  /** LinkedIn's line for how they know him, when we have it. */
  relation?: string;
  /** ISO date the recommendation was given. */
  date: string;
  /** Where people can see it on LinkedIn. */
  href: string;
};

/* LinkedIn's standard address for a profile's recommendations. */
const RECOMMENDATIONS = `${CONTACT.linkedin.replace(/\/?$/, '/')}details/recommendations/`;

export const TESTIMONIALS: Testimonial[] = [
  {
    short:
      'He has an incredible ability to take every website idea I throw his way and turn it into reality, often making it even better than I imagined.',
    quote: `Before Brendon joined our team, I already knew how incredible his wife, Kaylee, was. She's an absolute superstar on our Marketing team, so my hope was simply that he'd be at least half as amazing as she is. Somehow, he completely exceeded those expectations.

Brendon has been nothing short of phenomenal. He has an incredible ability to take every website idea I throw his way and turn it into reality, often making it even better than I imagined. His technical talent is matched by his dedication, work ethic, and willingness to tackle any challenge.

Brendon and Kaylee are truly a power duo, and any team would be lucky to have someone like Brendon. He's an exceptionally talented web developer, incredibly dependable, and someone you can trust to deliver outstanding work every time.`,
    name: 'Kiana Jane Stokes',
    title: 'Senior Director of Brand & Creative at PROLOOK',
    relation: 'Worked with Brendon at different companies',
    date: '2026-07-08',
    href: RECOMMENDATIONS,
  },
  {
    short:
      '…he makes sure that the details of his changes are clearly indicated… I found issues, and after I handed them over to Brendon, the fixes were resolved ASAP.',
    quote: `I have been working with Brendon on our projects for PROLOOK, and he has been awesome to work with. Whenever changes are ready for quality checking, he makes sure that the details of his changes are clearly indicated, which allows me to conduct a much more detailed assessment and testing.

When it comes to his development skills, I would say that he is on top of his game. I remember several instances where I found issues, and after I handed them over to Brendon, the fixes were resolved ASAP.

I am really grateful that I was given the opportunity to work on the PROLOOK project with Brendon. I appreciate his collaboration and attention to detail, and I look forward to continuing to work together and improve the project.`,
    name: 'Marco Angelo Solivar',
    title: 'Software QA | IT Software Consultant | Project Coordination and Business Analysis',
    relation: 'Worked with Brendon on the same team',
    date: '2026-09-22',
    href: RECOMMENDATIONS,
  },
  {
    short:
      "He's really good at taking what I'm trying to accomplish, asking questions when he needs to, and figuring out the best way to make it happen.",
    quote: `Bren is my husband, and getting to work with him on the PROLOOK website has been such a cool experience for me. I've always known how smart and hardworking he is, but there's something different about getting to see that side of him at work too.

I design a lot of the things that eventually get passed over to him to build, and I love getting to watch something go from an idea in Figma to something that actually works on the site. He's really good at taking what I'm trying to accomplish, asking questions when he needs to, and figuring out the best way to make it happen. And I can say from experience, I don't always give him the easiest things to build.

But my favorite thing about working with Bren is that he's the exact same person at work that he is everywhere else. He's patient, levelheaded, hardworking, and just someone you can count on. We've hiked a lot of really long miles together, gotten ourselves into some pretty big adventures, and now we get to work together too. No matter what we're doing, he's always the person I want next to me.

I'm really proud of him and everything he's built, and I feel pretty lucky that I get to be his wife AND work with him.`,
    name: 'Kaylee Jensen',
    title: 'Social Media Specialist',
    relation: 'Worked with Brendon on the same team',
    date: '2026-09-02',
    href: RECOMMENDATIONS,
  },
];

/* Everything the homepage carousel shows. */
export const HOME_TESTIMONIALS = TESTIMONIALS;
