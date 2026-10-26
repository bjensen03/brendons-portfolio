/*
  Code shown on the home page — the drifting field behind the hero and the
  typed panel in "What I build".

  Every snippet is an illustrative excerpt of a problem from one of the case
  studies (the `from` field says which, and which part of the YAML). They are
  rewritten to be short and readable, not copied from client code: no keys,
  no private URLs, no real table or option names beyond what the study itself
  says. If a study's story changes, the snippet next to it should too.
*/

export type Snippet = {
  lang: string;
  /** Study slug + section the snippet illustrates. */
  from: string;
  code: string;
};

const s = (lang: string, from: string, code: string): Snippet => ({
  lang,
  from,
  code: code.replace(/^\n/, '').replace(/\s+$/, ''),
});

/* --- The snippets ------------------------------------------------------ */

export const litespeedPortal = s(
  'PHP',
  'rally-trailer · hardProblem.fix + keyDecisions (exclusion lives in the theme)',
  `
// Lives in functions.php, where plugin updates can't undo it.
add_action('template_redirect', function () {
    if (is_user_logged_in() && is_page_template('templates/dealer-portal.php')) {
        // Keep LiteSpeed from caching the dealer portal.
        do_action('litespeed_control_set_nocache', 'dealer portal');
    }
});
`,
);

export const portalAjax = s(
  'JavaScript',
  'rally-trailer · hardProblem.fix (client-side guard)',
  `
// If the nonce expired, refresh it and retry once.
let res = await saveLead(form);
if (res.status === 403) {
  portal.nonce = await refreshNonce();
  res = await saveLead(form);
}
if (!res.ok) showNotice("That didn't save. Reload the page and try again.");
`,
);

export const dealerRouting = s(
  'PHP',
  'rally-trailer · story (Buy Now / Rent Now dealer routing)',
  `
// Send Buy Now and Rent Now leads to the dealer for the customer's ZIP.
$state  = rally_state_for_zip($zip);
$dealer = rally_dealer_for_territory($state, $zip);

wp_mail($dealer->email, "New {$type} lead: {$trailer}", $summary);
`,
);

export const groceryCost = s(
  'TypeScript',
  'meal-planner · commit c3f04a8 (src/lib/cost.ts)',
  `
// Calculate the price by weight instead of package size.
// 1020 g of salmon was billed as three 1 lb packs ($36) instead of $26.96.
const usedFraction = needed / record.qty
const packages = record.soldByWeight ? 0 : piecesToBuy(usedFraction)
const cents = record.soldByWeight
  ? Math.max(1, Math.round(price * usedFraction))
  : packages * price
`,
);

export const lunchReminder = s(
  'PHP',
  'lincoln-academy · hardProblem.fix',
  `
// Send each teacher one lunch reminder per day.
$key  = 'lunch_reminded_' . wp_date('Y-m-d');
$sent = get_option($key, []);

foreach ($missing as $teacher) {
    if (in_array($teacher->ID, $sent, true)) continue;
    if (wp_mail($teacher->user_email, $subject, $body, $headers)) {
        $sent[] = $teacher->ID;
        update_option($key, $sent, false);
    }
}
`,
);

export const reminderAudit = s(
  'SQL',
  'lincoln-academy · hardProblem.verified',
  `
-- Show who was reminded over the last seven days.
SELECT option_name, option_value
FROM wp_options
WHERE option_name LIKE 'lunch\\_reminded\\_%'
ORDER BY option_name DESC
LIMIT 7;
`,
);

export const legendsFocus = s(
  'JavaScript',
  'legends · hardProblem.fix',
  `
// Move focus into the panel without scrolling the drawer.
function openPanel(panel) {
  drawer.dataset.view = panel.id;
  panel.querySelector('a')?.focus({ preventScroll: true });
}
`,
);

export const legendsDrawer = s(
  'SCSS',
  'legends · hardProblem.fix',
  `
// Keep the men's and women's panels side by side.
.drawer {
  &__track {
    display: flex;
    overflow: hidden;
    overscroll-behavior: contain;
  }

  &__panel {
    flex: 0 0 100%;
  }
}
`,
);

export const shopGuard = s(
  'JavaScript',
  'all-in · hardProblem.fix',
  `
// src/routes/shop/+page.server.js
import { redirect } from '@sveltejs/kit';

// Read the flag per request, not from a shared value.
export const load = async ({ locals }) => {
  if (!locals.flags.shopActive) throw redirect(307, '/');
  return {};
};
`,
);

export const shopNav = s(
  'Svelte',
  'all-in · hardProblem.fix',
  `
<script>
  // Use the same flag as the Shop guard and the footer.
  export let data;
</script>

{#if data.flags.shopActive}
  <a href="/shop">Shop</a>
{/if}
`,
);

export const voltaPin = s(
  'Shell',
  'all-in · keyDecisions',
  `
# Use the team's Node version instead of upgrading.
volta pin node@18.14.0
npm ci && npm run dev
`,
);

export const bladeLabel = s(
  'Blade',
  'prolook · hardProblem.fix',
  `
{{-- partials/product-label.blade.php --}}
{{-- A new partial path makes Blade compile a fresh view. --}}
@foreach (explode('|', $label) as $line)
  <span class="block">{{ $line }}</span>
@endforeach
`,
);

export const fontPermissions = s(
  'nginx',
  'quickstrike · hardProblem.fix',
  `
# Font permissions caused nginx to return 403 errors.
#   chmod 644 assets/fonts/*.otf
location ~* \\.(otf|woff2?)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
`,
);

export const mealSwap = s(
  'TSX',
  'meal-planner · src/app/plan/[id]/SwapButton.tsx (condensed: the app also shows an error line)',
  `
// Disable the button while the swap runs.
const [pending, startTransition] = useTransition()
function swap() {
  startTransition(async () => {
    await swapMeal(planMealId)
  })
}
return (
  <button onClick={swap} disabled={pending}>
    {pending ? 'Swapping…' : 'Swap'}
  </button>
)
`,
);

export const mustacheNav = s(
  'Mustache',
  'quickstrike · keyDecisions',
  `
{{! Keep the PHP and Mustache structure, with a rebuilt front end. }}
<nav class="site-nav">
  {{#links}}
    <a href="{{url}}"{{#active}} aria-current="page"{{/active}}>{{label}}</a>
  {{/links}}
</nav>
`,
);

/* --- The hero field: two columns ---------------------------------------

   The left column bleeds off the left edge and stops short of the middle;
   the right one starts past the middle and runs off the right edge. Long
   lines are fine in either — they leave the screen, they never collide. */

export const fieldColumns: Snippet[][] = [
  [litespeedPortal, legendsFocus, reminderAudit, mustacheNav, shopNav, voltaPin, legendsDrawer],
  [lunchReminder, groceryCost, fontPermissions, shopGuard, bladeLabel, portalAjax, dealerRouting],
];

/* --- What I build ------------------------------------------------------ */

export type BuildLine = {
  label: string;
  project: string;
  snippet: Snippet;
};

export const buildLines: BuildLine[] = [
  { label: 'WordPress themes', project: 'Rally Trailer Manufacturing', snippet: litespeedPortal },
  { label: 'Custom PHP', project: 'Lincoln Academy', snippet: lunchReminder },
  { label: 'JavaScript\u00a0/ TypeScript', project: 'ALL IN Tournament', snippet: shopGuard },
  { label: 'React & Svelte', project: 'Meal Planner, my own app', snippet: mealSwap },
  { label: 'APIs & integrations', project: 'Rally Trailer Manufacturing', snippet: dealerRouting },
  { label: 'Front-end fixes', project: 'Rally Trailer Manufacturing', snippet: portalAjax },
  { label: 'SQL', project: 'Lincoln Academy', snippet: reminderAudit },
];

/* --- A deliberately small highlighter -----------------------------------

   Three roles only, because the palette is three tokens: comments are muted,
   strings take the accent, everything else is plain foreground. Good enough
   to read as code; not trying to be a grammar.
*/

export type Token = { text: string; role: 'plain' | 'comment' | 'string' };

const pattern =
  /(\{\{--[\s\S]*?--\}\}|\{\{![\s\S]*?\}\}|\/\/[^\n]*|(?:^|(?<=\s))#[^\n]*|--\s[^\n]*)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")/gm;

export const highlight = (code: string): Token[] => {
  const out: Token[] = [];
  let last = 0;
  for (const m of code.matchAll(pattern)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: code.slice(last, i), role: 'plain' });
    out.push({ text: m[0], role: m[1] ? 'comment' : 'string' });
    last = i + m[0].length;
  }
  if (last < code.length) out.push({ text: code.slice(last), role: 'plain' });
  return out;
};
