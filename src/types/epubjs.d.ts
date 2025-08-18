declare module 'epubjs' {
  export class Book {
    constructor(source: string | Blob | ArrayBuffer, options?: any)
    ready: Promise<void>
    renderTo(element: HTMLElement, options?: any): Rendition
    rendition?: Rendition
  }

  export class Rendition {
    constructor(book: Book, options?: any)
    themes: {
      default(styles: any): void
      fontSize(size: string): void
    }
    on(event: string, callback: (location: any) => void): void
    display(location?: string): Promise<void>
    next(): void
    prev(): void
    destroy(): void
    attachTo(element: HTMLElement): void
  }
}
