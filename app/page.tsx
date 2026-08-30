export const revalidate = 60;

import Home from '@/components/site/home';

const homeTextSliderStyles = `
  /* Homepage hero: delivery-banner-sized, text-only slider. Visual-only patch. */
  .home-premium-scope .hero-wrap { width:min(100%,1280px)!important; max-width:1280px!important; aspect-ratio:3.4/1!important; max-height:380px!important; min-height:0!important; border-radius:1.5rem!important; overflow:hidden!important; background:linear-gradient(115deg,#056b50 0%,#07845d 48%,#16a34a 100%)!important; box-shadow:0 24px 60px -40px rgba(5,150,105,.65)!important; }
  .home-premium-scope .hero-wrap::before,.home-premium-scope .hero-wrap::after{display:none!important;}
  .home-premium-scope .hero-inner{height:100%!important;width:100%!important;padding:2rem clamp(2rem,5vw,4rem)!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;}
  .home-premium-scope .hero-inner>div:first-child,.home-premium-scope .hero-wrap>div>div:first-child{position:absolute!important;inset:0!important;left:0!important;top:0!important;bottom:0!important;width:100%!important;max-width:100%!important;padding:2rem clamp(2.5rem,7vw,6rem)!important;box-sizing:border-box!important;transform:none!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;z-index:4!important;}
  .home-premium-scope .hero-inner>div:last-child picture{display:none!important;}
  .home-premium-scope .hero-title{max-width:850px!important;margin:0!important;color:#fff!important;font-size:clamp(2rem,4vw,3.5rem)!important;line-height:1.08!important;letter-spacing:-.035em!important;text-shadow:0 3px 18px rgba(0,0,0,.18)!important;}
  .home-premium-scope .hero-subtitle{max-width:720px!important;margin:.8rem auto 0!important;color:rgba(255,255,255,.94)!important;font-size:clamp(.9rem,1.2vw,1.08rem)!important;line-height:1.55!important;text-shadow:0 2px 10px rgba(0,0,0,.16)!important;}
  .home-premium-scope .hero-btn{margin:1rem auto 0!important;min-height:44px!important;padding:.62rem 1.2rem!important;background:#fff!important;color:#086b4f!important;border-radius:999px!important;box-shadow:0 12px 28px -16px rgba(0,0,0,.45)!important;}
  /* Desktop only: keep CTA inside the hero at the bottom-right corner. */
  @media(min-width:768px){
    .home-premium-scope .hero-inner>div:first-child .hero-btn,.home-premium-scope .hero-wrap>div>div:first-child .hero-btn{position:absolute!important;right:28px!important;bottom:24px!important;margin:0!important;}
  }
  .home-premium-scope .hero-wrap>div.block::before,.home-premium-scope .hero-wrap>div.block::after{z-index:8!important;}
  @media(max-width:767px){
    .home-premium-scope .hero-wrap{width:100%!important;aspect-ratio:2/1!important;max-height:none!important;border-radius:1rem!important;}
    .home-premium-scope .hero-inner>div:first-child,.home-premium-scope .hero-wrap>div>div:first-child{padding:1rem 2.5rem!important;}
    .home-premium-scope .hero-title{font-size:clamp(1.3rem,6vw,1.85rem)!important;line-height:1.1!important;}
    .home-premium-scope .hero-subtitle{max-width:90%!important;margin-top:.45rem!important;font-size:clamp(.7rem,3vw,.82rem)!important;line-height:1.35!important;}
    .home-premium-scope .hero-btn{min-height:34px!important;margin-top:.6rem!important;padding:.42rem .85rem!important;font-size:.72rem!important;}
  }
`;

export default function Page() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: homeTextSliderStyles }} />
      <Home />
    </>
  );
}
