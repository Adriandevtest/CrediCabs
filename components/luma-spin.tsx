export const LumaSpin = () => {
  return (
    <div
      className="relative w-[65px] aspect-square"
      style={{
        ['--loader-color' as string]: '#1f2937',
      }}
    >
      <style>{`
        @keyframes loaderAnim {
          0%    { inset: 0 35px 35px 0; }
          12.5% { inset: 0 35px 0 0; }
          25%   { inset: 35px 35px 0 0; }
          37.5% { inset: 35px 0 0 0; }
          50%   { inset: 35px 0 0 35px; }
          62.5% { inset: 0 0 0 35px; }
          75%   { inset: 0 0 35px 35px; }
          87.5% { inset: 0 0 35px 0; }
          100%  { inset: 0 35px 35px 0; }
        }
        .luma-anim { animation: loaderAnim 2.5s infinite; }
        .luma-anim-delay { animation: loaderAnim 2.5s -1.25s infinite; }
      `}</style>
      <span className="absolute rounded-[50px] shadow-[inset_0_0_0_3px] shadow-gray-800 luma-anim" />
      <span className="absolute rounded-[50px] shadow-[inset_0_0_0_3px] shadow-gray-800 luma-anim-delay" />
    </div>
  );
};
