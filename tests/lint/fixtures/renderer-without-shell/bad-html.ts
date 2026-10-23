import { type RenderedPage } from '@odudu/kernel';

export function renderBad(): RenderedPage {
  return {
    title: 'Bad',
    body: '<p>hello</p>',
    script: null,
    frames: [],
    html: '<!doctype html><html lang="en"><head><link rel="stylesheet" href="/x.css"></head><body><p style="color:red">hello</p></body></html>',
  };
}
