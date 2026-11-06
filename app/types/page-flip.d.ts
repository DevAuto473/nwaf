// أنواع مختصرة لمكتبة page-flip (StPageFlip, MIT) — المكتبة لا تشحن ملفات أنواع
declare module "page-flip/dist/js/page-flip.module.js" {
  export interface PageFlipSettings {
    width: number;
    height: number;
    size?: "fixed" | "stretch";
    startPage?: number;
    showCover?: boolean;
    usePortrait?: boolean;
    drawShadow?: boolean;
    maxShadowOpacity?: number;
    flippingTime?: number;
    mobileScrollSupport?: boolean;
    clickEventForward?: boolean;
    useMouseEvents?: boolean;
    swipeDistance?: number;
    showPageCorners?: boolean;
    disableFlipByClick?: boolean;
    autoSize?: boolean;
    startZIndex?: number;
  }
  export class PageFlip {
    constructor(element: HTMLElement, settings: PageFlipSettings);
    loadFromHTML(items: HTMLElement[]): void;
    on(event: "flip" | "changeState" | "changeOrientation" | "init" | "update", cb: (e: { data: unknown }) => void): this;
    flipNext(corner?: "top" | "bottom"): void;
    flipPrev(corner?: "top" | "bottom"): void;
    flip(page: number, corner?: "top" | "bottom"): void;
    turnToPage(page: number): void;
    getCurrentPageIndex(): number;
    getUI(): unknown;
    getPageCount(): number;
    update(): void;
    destroy(): void;
  }
}
