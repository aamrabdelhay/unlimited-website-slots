/**
 * Raw CSS injected only when this slot renders. Layout styling lives in
 * Tailwind classes inside the pages/components; this file holds motion and
 * typographic refinement.
 */
export const siteStyles = /* css */ `
  @keyframes meridian-rise {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .meridian-rise {
    animation: meridian-rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @media (prefers-reduced-motion: reduce) {
    .meridian-rise { animation: none; }
  }
`;
