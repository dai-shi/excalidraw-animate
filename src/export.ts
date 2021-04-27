import { fileSave } from "browser-fs-access";

export const exportToSvgFile = async (svg: SVGSVGElement) => {
  const savedMs = svg.getCurrentTime();
  svg.setCurrentTime(0);
  const svgStr = new XMLSerializer().serializeToString(svg);
  svg.setCurrentTime(savedMs);
  await fileSave(new Blob([svgStr], { type: "image/svg+xml" }), {
    fileName: "excalidraw-animate.svg",
    extensions: [".svg"],
  });
};

export const exportToWebmFile = async (data: Blob) => {
  await fileSave(new Blob([data], { type: "video/webm" }), {
    fileName: "excalidraw-animate.webm",
    extensions: [".webm"],
  });
};

export const prepareWebmData = (
  svgList: {
    svg: SVGSVGElement;
    finishedMs: number;
  }[]
) =>
  new Promise<Blob>(async (resolve, reject) => {
    try {
      const stream = (await (navigator.mediaDevices as any).getDisplayMedia({
        video: {
          cursor: "never",
          displaySurface: "browser",
        },
      })) as MediaStream;
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        resolve(e.data);
      };
      let maxFinishedMs = 0;
      svgList.forEach(({ svg, finishedMs }) => {
        maxFinishedMs = Math.max(maxFinishedMs, finishedMs);
        svg.pauseAnimations();
        svg.setCurrentTime(0);
      });
      recorder.start();
      svgList.forEach(({ svg }) => {
        svg.unpauseAnimations();
      });
      setTimeout(() => {
        recorder.stop();
        stream.getVideoTracks()[0].stop();
      }, maxFinishedMs);
    } catch (e) {
      reject(e);
    }
  });
