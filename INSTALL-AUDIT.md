# 설치 정보 검수 — 2026-09-07

100개 앱의 등록 릴리스와 기존 341개 파일을 공식 GitHub 응답에 대조했습니다. 누락된 파일 10개를 추가하고 Joplin의 Mac ZIP 2개를 DMG로 교체했습니다. 검수 후 카탈로그는 **100개 앱·351개 파일**이며 15개 앱의 정보가 수정되었습니다.

검수 시각: 2026-09-07 KST / 2026-09-06 UTC. JSON의 `checked` 날짜는 기존 수집기와 동일하게 UTC 기준입니다. 이 문서는 해당 시점의 점검 기록이며 릴리스 최신성을 계속 보장하지 않습니다.

## 확인 결과

| 확인 항목 | 결과 |
| --- | --- |
| 등록한 태그·공식 릴리스 URL·배포일·정식 릴리스 여부 | 100/100 일치 |
| 파일명·다운로드 URL·바이트 크기·업로드 상태 | 351/351 일치 |
| 설치 파일 링크 HEAD, HTTPS 리다이렉트 후 응답 | 351/351 HTTP 200 |
| 현 카탈로그의 파일·홈페이지·설치 안내 URL | 중복 제외 548/548 HTTP 200 |
| CPU 안내를 추가 확인해야 하는 파일 | 59개, 아래 앱별 표 참조 |

파일의 출처·형식과 링크를 검수했습니다. 설치 파일은 내려받거나 실행하지 않았습니다. 실제 CPU 호환성, 바이너리 서명·악성코드, 모든 기능 설명의 실제 동작, 안내 페이지의 앵커와 로그인 후 화면은 검증 범위에 포함하지 않습니다. CPU 안내는 파일명 또는 공식 문서에 근거하며 파일명에 정보가 없는 경우 추정하지 않습니다.

## 수정 사항과 근거

- **OBS Studio:** 등록된 Linux 선택지에 비어 있던 Ubuntu 24.04·26.04 x86_64 DEB 2개를 추가했습니다. macOS 12 지원 안내를 제거하고 NVIDIA NVENC 드라이버 570 이상 조건을 반영했습니다. [공식 릴리스](https://github.com/obsproject/obs-studio/releases/tag/32.2.2)
- **SiYuan:** ARM64만 등록되어 있던 Windows·macOS·Linux에 x64 파일 3개를 추가했습니다. 파일명에 CPU 표기가 없는 배포본은 공식 다운로드 표와 macOS 빌드 설정을 확인했습니다. [다운로드 표](https://b3log.org/siyuan/download.html), [macOS 빌드 설정](https://github.com/siyuan-note/siyuan/blob/v3.8.2/app/electron-builder-darwin.yml)
- **Rufus:** Windows x64·x86 파일 2개를 추가했습니다. [공식 다운로드 표](https://rufus.ie/en/)
- **draw.io:** Windows x64 설치 파일을 추가하고 macOS 13 이상·32비트 Windows 지원 종료를 안내했습니다. [공식 릴리스](https://github.com/jgraph/drawio-desktop/releases/tag/v31.4.2), [x64 빌드 설정](https://github.com/jgraph/drawio-desktop/blob/v31.4.2/electron-builder-win.json)
- **LocalSend·VSCodium:** Linux ARM64 DEB를 각 1개 추가했습니다. LocalSend의 unsigned EXE와 별도 CLI 파일은 데스크톱 선택지에 추가하지 않았습니다. [LocalSend 릴리스](https://github.com/localsend/localsend/releases/tag/v1.18.2), [VSCodium 릴리스](https://github.com/VSCodium/vscodium/releases/tag/1.126.04524)
- **Joplin:** Mac의 Apple Silicon·Intel ZIP 2개를 같은 릴리스의 DMG로 교체했습니다. [공식 릴리스](https://github.com/laurent22/joplin/releases/tag/v3.6.16), [설치 안내](https://joplinapp.org/help/install/)
- **ImageGlass:** macOS·Linux 배포본이 실제로 있음을 확인하고 Windows 전용처럼 보이던 소개를 수정했습니다. 버전 10의 OS·CPU 조건과 소스 라이선스/공식 바이너리 배포 조건 구분을 표시했습니다. [공식 README](https://github.com/d2phap/ImageGlass/blob/develop/README.md), [배포 조건 원문](https://github.com/d2phap/ImageGlass/blob/develop/LICENSE)
- **웹 표시:** 모든 앱에 붙던 무료 배포 문구를 공식 배포 문구로 바꿨습니다. 오픈소스 라이선스만으로 연결한 바이너리까지 무료라고 단정하지 않으며, 준비 조건에서 각 배포본의 이용 조건을 안내합니다.
- **Moonlight·darktable·Ferdium·Stellarium:** 릴리스에 명시된 OS 최소 조건·32비트 지원 여부를 준비 조건에 반영했습니다. 아래 표의 해당 릴리스 링크가 근거입니다. Stellarium macOS 파일에는 공식 릴리스의 Universal 표기를 반영했습니다.
- **홈페이지:** Audacity의 HTTP 404 주소를 공식 홈페이지로, PrusaSlicer의 HTTPS 외 리다이렉트 주소를 공식 저장소로 교체했습니다. Etcher의 기존 주소는 HEAD 405로 확인 불가였으며, 공식 README가 안내하는 현재 홈페이지로 변경했습니다. [Audacity 공식 README](https://github.com/audacity/audacity/blob/master/README.md), [PrusaSlicer 공식 저장소](https://github.com/prusa3d/PrusaSlicer), [Etcher 공식 README](https://github.com/balena-io/etcher/blob/master/README.md)
- **수집기:** OBS의 dSYM, LocalSend CLI, VSCodium REH, fooyin FreeBSD PKG가 일반 데스크톱 설치 파일로 분류되는 문제를 수정하고 `npm run check`에 회귀 검사를 추가했습니다. 등록된 기존 341개 파일에는 이 파일들이 없었습니다.

## 남은 확인 범위

각 프로젝트의 모든 배포 형식을 등록하지는 않습니다. 기존에 빠져 있던 일부 Intel Mac·32비트·기타 CPU 변형과 배포판별 패키지는 공식 릴리스에서 추가 선택할 수 있습니다. CPU가 드러나지 않은 파일의 상세 조건과 실제 설치 검증은 후속 작업입니다. ImageGlass처럼 소스와 바이너리 조건이 다른 앱은 공개 목록에서 구분해 안내해야 합니다. 라이선스·이미지 재배포 조건 전체 검수는 별도 공개 준비 작업입니다.

## 앱별 점검 기록

아래 파일 수는 수정 후 기준입니다. 모든 행의 릴리스 메타데이터·파일 출처·다운로드 HEAD 검사는 통과했습니다. CPU 추가 확인 수가 0이어도 실제 기기 실행을 검증했다는 뜻은 아닙니다.

| 앱·공식 릴리스 | 파일 수 | CPU 추가 확인 |
| --- | ---: | ---: |
| [LocalSend](https://github.com/localsend/localsend/releases/tag/v1.18.2) | 5 | 1 |
| [OBS Studio](https://github.com/obsproject/obs-studio/releases/tag/32.2.2) | 6 | 0 |
| [Upscayl](https://github.com/upscayl/upscayl/releases/tag/v2.15.0) | 3 | 3 |
| [Joplin](https://github.com/laurent22/joplin/releases/tag/v3.6.16) | 4 | 2 |
| [LosslessCut](https://github.com/mifi/lossless-cut/releases/tag/v3.69.0) | 5 | 0 |
| [VSCodium](https://github.com/VSCodium/vscodium/releases/tag/1.126.04524) | 6 | 0 |
| [KeePassXC](https://github.com/keepassxreboot/keepassxc/releases/tag/2.7.12) | 4 | 0 |
| [Cryptomator](https://github.com/cryptomator/cryptomator/releases/tag/1.19.3) | 5 | 0 |
| [RustDesk](https://github.com/rustdesk/rustdesk/releases/tag/1.4.9) | 6 | 0 |
| [qBittorrent](https://github.com/qbittorrent/qBittorrent/releases/tag/release-5.2.3) | 3 | 1 |
| [Transmission](https://github.com/transmission/transmission/releases/tag/4.1.3) | 2 | 1 |
| [PeaZip](https://github.com/peazip/PeaZip/releases/tag/11.2.0) | 4 | 0 |
| [NanaZip](https://github.com/M2Team/NanaZip/releases/tag/6.5.1800.0) | 1 | 1 |
| [Double Commander](https://github.com/doublecmd/doublecmd/releases/tag/v1.2.8) | 3 | 0 |
| [muCommander](https://github.com/mucommander/mucommander/releases/tag/1.6.2-1) | 6 | 0 |
| [WinMerge](https://github.com/WinMerge/winmerge/releases/tag/v2.16.58.2) | 2 | 0 |
| [ShareX](https://github.com/ShareX/ShareX/releases/tag/v21.0.0) | 1 | 0 |
| [Flameshot](https://github.com/flameshot-org/flameshot/releases/tag/v14.0.0) | 3 | 0 |
| [Greenshot](https://github.com/greenshot/greenshot/releases/tag/v1.3.315) | 1 | 1 |
| [ScreenToGif](https://github.com/NickeManarin/ScreenToGif/releases/tag/2.43.2) | 2 | 0 |
| [Sunshine](https://github.com/LizardByte/Sunshine/releases/tag/v2026.516.143833) | 6 | 0 |
| [Moonlight](https://github.com/moonlight-stream/moonlight-qt/releases/tag/v6.1.0) | 3 | 2 |
| [Audacity](https://github.com/audacity/audacity/releases/tag/Audacity-4.0.0) | 5 | 0 |
| [MuseScore Studio](https://github.com/musescore/MuseScore/releases/tag/v4.7.4) | 4 | 1 |
| [Hydrogen](https://github.com/hydrogen-music/hydrogen/releases/tag/1.2.6) | 3 | 1 |
| [Strawberry](https://github.com/strawberrymusicplayer/strawberry/releases/tag/1.2.28) | 1 | 0 |
| [fooyin](https://github.com/fooyin/fooyin/releases/tag/v0.12.6) | 4 | 0 |
| [IINA](https://github.com/iina/iina/releases/tag/v1.4.4) | 1 | 1 |
| [MPC-HC](https://github.com/clsid2/mpc-hc/releases/tag/2.8.1) | 1 | 0 |
| [HandBrake](https://github.com/HandBrake/HandBrake/releases/tag/1.11.2) | 3 | 1 |
| [Shotcut](https://github.com/mltframework/shotcut/releases/tag/v26.8.1) | 3 | 1 |
| [darktable](https://github.com/darktable-org/darktable/releases/tag/release-5.6.1) | 5 | 0 |
| [RawTherapee](https://github.com/RawTherapee/RawTherapee/releases/tag/5.13) | 5 | 0 |
| [Pixelorama](https://github.com/Orama-Interactive/Pixelorama/releases/tag/v1.2.1) | 3 | 2 |
| [Pinta](https://github.com/PintaProject/Pinta/releases/tag/3.1.2) | 4 | 0 |
| [nomacs](https://github.com/nomacs/nomacs/releases/tag/3.22.3) | 5 | 0 |
| [ksnip](https://github.com/ksnip/ksnip/releases/tag/v1.10.1) | 3 | 2 |
| [ImageGlass](https://github.com/d2phap/ImageGlass/releases/tag/10.0.6.906) | 4 | 0 |
| [draw.io Desktop](https://github.com/jgraph/drawio-desktop/releases/tag/v31.4.2) | 5 | 0 |
| [Xournal++](https://github.com/xournalpp/xournalpp/releases/tag/v1.3.7) | 6 | 0 |
| [AppFlowy](https://github.com/AppFlowy-IO/AppFlowy/releases/tag/0.14.1) | 3 | 0 |
| [Logseq](https://github.com/logseq/logseq/releases/tag/2.0.1) | 6 | 0 |
| [Zettlr](https://github.com/Zettlr/Zettlr/releases/tag/v4.7.0) | 5 | 0 |
| [MarkText](https://github.com/marktext/marktext/releases/tag/v0.19.1) | 5 | 1 |
| [SiYuan](https://github.com/siyuan-note/siyuan/releases/tag/v3.8.2) | 6 | 0 |
| [Trilium Notes](https://github.com/TriliumNext/Trilium/releases/tag/v0.105.0) | 6 | 0 |
| [Standard Notes](https://github.com/standardnotes/app/releases/tag/%40standardnotes/desktop%403.202.0) | 5 | 0 |
| [Notesnook](https://github.com/streetwriters/notesnook/releases/tag/v3.4.7) | 6 | 0 |
| [QOwnNotes](https://github.com/pbek/QOwnNotes/releases/tag/v26.9.1) | 2 | 1 |
| [Notepad++](https://github.com/notepad-plus-plus/notepad-plus-plus/releases/tag/v8.9.8) | 2 | 0 |
| [Notepad Next](https://github.com/dail8859/NotepadNext/releases/tag/v0.14) | 3 | 1 |
| [Geany](https://github.com/geany/geany/releases/tag/2.1.0) | 2 | 1 |
| [TeXstudio](https://github.com/texstudio-org/texstudio/releases/tag/4.9.7) | 4 | 2 |
| [PDF Arranger](https://github.com/pdfarranger/pdfarranger/releases/tag/1.14.0) | 1 | 1 |
| [PDFsam Basic](https://github.com/torakiki/pdfsam/releases/tag/v6.0.5) | 4 | 0 |
| [calibre](https://github.com/kovidgoyal/calibre/releases/tag/v9.14.0) | 2 | 2 |
| [Koodo Reader](https://github.com/koodo-reader/koodo-reader/releases/tag/v2.4.4) | 6 | 0 |
| [Foliate](https://github.com/johnfactotum/foliate/releases/tag/3.3.0) | 1 | 1 |
| [Tropy](https://github.com/tropy/tropy/releases/tag/v1.17.3) | 4 | 0 |
| [JabRef](https://github.com/JabRef/jabref/releases/tag/v5.15) | 3 | 1 |
| [Anki](https://github.com/ankitects/anki/releases/tag/26.08.1) | 4 | 0 |
| [Stellarium](https://github.com/Stellarium/stellarium/releases/tag/v26.2) | 4 | 0 |
| [Celestia](https://github.com/CelestiaProject/Celestia/releases/tag/1.6.4) | 2 | 2 |
| [FreeCAD](https://github.com/FreeCAD/FreeCAD/releases/tag/1.1.3) | 5 | 0 |
| [LibreCAD](https://github.com/LibreCAD/LibreCAD/releases/tag/v2.2.1.5) | 4 | 0 |
| [UltiMaker Cura](https://github.com/Ultimaker/Cura/releases/tag/5.13.0) | 4 | 0 |
| [PrusaSlicer](https://github.com/prusa3d/PrusaSlicer/releases/tag/version_2.9.6) | 2 | 2 |
| [SuperTuxKart](https://github.com/supertuxkart/stk-code/releases/tag/1.5) | 3 | 1 |
| [Warzone 2100](https://github.com/Warzone2100/warzone2100/releases/tag/4.7.0) | 4 | 0 |
| [DBeaver Community](https://github.com/dbeaver/dbeaver/releases/tag/26.2.0) | 6 | 0 |
| [DB Browser for SQLite](https://github.com/sqlitebrowser/sqlitebrowser/releases/tag/v3.13.1) | 4 | 1 |
| [Bruno](https://github.com/usebruno/bruno/releases/tag/v4.1.0) | 6 | 0 |
| [Insomnia](https://github.com/Kong/insomnia/releases/tag/core%4013.2.0) | 3 | 3 |
| [Zed](https://github.com/zed-industries/zed/releases/tag/v1.18.1) | 4 | 0 |
| [Lapce](https://github.com/lapce/lapce/releases/tag/v0.4.6) | 4 | 2 |
| [Tabby](https://github.com/Eugeny/tabby/releases/tag/v1.0.235) | 6 | 0 |
| [Alacritty](https://github.com/alacritty/alacritty/releases/tag/v0.17.0) | 2 | 2 |
| [Windows Terminal](https://github.com/microsoft/terminal/releases/tag/v1.24.11911.0) | 2 | 0 |
| [Microsoft PowerToys](https://github.com/microsoft/PowerToys/releases/tag/v0.101.2362.0) | 2 | 0 |
| [Ventoy](https://github.com/ventoy/Ventoy/releases/tag/v1.1.17) | 1 | 1 |
| [balenaEtcher](https://github.com/balena-io/etcher/releases/tag/v2.1.6) | 4 | 0 |
| [Rufus](https://github.com/pbatard/rufus/releases/tag/v4.15) | 3 | 0 |
| [BleachBit](https://github.com/bleachbit/bleachbit/releases/tag/v6.0.3) | 2 | 1 |
| [Buzz](https://github.com/chidiwilliams/buzz/releases/tag/v1.4.5) | 3 | 1 |
| [Vibe](https://github.com/thewh1teagle/vibe/releases/tag/v3.2.2) | 5 | 0 |
| [CopyQ](https://github.com/hluk/CopyQ/releases/tag/v16.0.0) | 3 | 1 |
| [Pot](https://github.com/pot-app/pot-desktop/releases/tag/3.0.7) | 6 | 0 |
| [CopyTranslator](https://github.com/CopyTranslator/CopyTranslator/releases/tag/v12.1.0) | 1 | 1 |
| [OpenBoard](https://github.com/OpenBoard-org/OpenBoard/releases/tag/v1.7.7) | 3 | 2 |
| [Dopamine](https://github.com/digimezzo/dopamine/releases/tag/v3.0.10) | 3 | 2 |
| [Nuclear](https://github.com/nukeop/nuclear/releases/tag/player%401.48.3) | 4 | 0 |
| [Ferdium](https://github.com/ferdium/ferdium-app/releases/tag/v7.2.2) | 6 | 0 |
| [ActivityWatch](https://github.com/ActivityWatch/activitywatch/releases/tag/v0.13.2) | 3 | 0 |
| [Kap](https://github.com/wulkano/Kap/releases/tag/v3.6.0) | 2 | 0 |
| [MeetingBar](https://github.com/leits/MeetingBar/releases/tag/v4.11.6) | 1 | 1 |
| [Stats](https://github.com/exelban/stats/releases/tag/v3.0.14) | 1 | 1 |
| [MonitorControl](https://github.com/MonitorControl/MonitorControl/releases/tag/v4.3.3) | 1 | 1 |
| [Ice](https://github.com/jordanbaird/Ice/releases/tag/0.11.12) | 1 | 1 |
| [QuickLook](https://github.com/QL-Win/QuickLook/releases/tag/4.5.0) | 1 | 1 |
| [PicView](https://github.com/Ruben2776/PicView/releases/tag/5.0.6) | 4 | 0 |

## 재확인

`npm run check`는 문법·스키마·README·수집 분류 검사를 실행합니다. `npm test`는 로컬 PostgreSQL·HTTP 통합 검사를 추가합니다. 최신 릴리스와의 차이는 `npm run collect -- --refresh --scan=12`로 검토용 보고서를 만들 수 있습니다. 이 명령은 현재 문서의 모든 외부 링크 HEAD 검사를 대신하지 않습니다.

검수한 apps.json SHA-256: `7bedd814689b654a696c97fdefff47b77787d3f47228561c35a1d7183aba998a`
