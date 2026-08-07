'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Lang = 'en' | 'bn';

const en = {
  'howItWorks': 'How it works',
  'platforms': 'Platforms',
  'faq': 'FAQ',

  'heroBadge': 'Free · No API keys · No watermark',
  'heroTitle1': 'Universal',
  'heroTitle2': 'Social Media',
  'heroTitle3': 'Downloader',
  'heroSubtitle': 'Save videos, MP3 audio, and high-resolution images from YouTube, Facebook, Instagram, TikTok, X / Twitter, Threads, and Pinterest — directly to your phone or computer in one tap.',

  'inputPlaceholder': 'Paste a YouTube, Facebook, Instagram, TikTok, X, Threads, or Pinterest link…',
  'clearInput': 'Clear input',
  'paste': 'Paste',
  'pasteFromClipboard': 'Paste from clipboard',
  'extract': 'Extract',
  'extracting': 'Extracting…',
  'detectedPlatform': 'Detected platform',
  'linkPasted': 'Link pasted from clipboard',
  'clipboardEmpty': 'Clipboard is empty',
  'clipboardBlocked': 'Clipboard access is blocked in this browser',
  'clipboardManual': 'Could not read the clipboard. Paste manually instead.',
  'pasteLinkFirst': 'Please paste a link first',
  'linkNotSupported': 'This link is not supported',
  'mediaReady': 'Media ready — choose a format below',
  'genericError': 'Something went wrong. Please try again.',
  'extractionFailed': 'Extraction failed',
  'networkError': 'Network error. Please check your connection and try again.',
  'serverUnreachable': 'Could not reach the server',
  'processing': 'Processing your link…',

  'customFilename': 'Custom filename (optional)',
  'downloadOptions': 'Download options',
  'save': 'Save',
  'starting': 'Starting…',
  'downloading': 'Downloading {label}',
  'downloadDisclaimer': 'Your file streams directly from the source server. Only download content you have the right to.',
  'options': 'options',
  'option': 'option',
  'tierUltra': 'Ultra HD / 1080p',
  'tierHd': 'HD / 720p',
  'tierSd': 'Medium / SD',
  'tierAudio': 'MP3 Audio',
  'tierImage': 'HD Thumbnail',
  'thumbnailButton': 'Download HD/4K Thumbnail',
  'thumbnailCaption': 'JPG · Full resolution',

  'howItWorksBadge': 'How it works',
  'howItWorksTitle': 'Three steps, zero friction',
  'step1Title': 'Paste a link',
  'step1Desc': 'Copy any public video or pin URL. Our smart input auto-detects the platform instantly.',
  'step2Title': 'Native extraction',
  'step2Desc': 'Our server parses the page metadata and locates the raw, full-quality media streams.',
  'step3Title': 'Save it anywhere',
  'step3Desc': 'Pick a format and the file streams straight to your phone or computer as a native download.',
  'howItWorksNote': '100% native server logic — no paid APIs, no sign-ups, no hidden limits.',

  'platformsBadge': 'Supported platforms',
  'platformsTitle': 'Seven platforms. One downloader.',
  'platformsSubtitle': 'Purpose-built native parsers for each platform — no third-party services in between.',

  'featYt1': 'HD video download',
  'featYt2': 'MP3 audio extraction',
  'featYt3': 'Shorts, Live & 4K thumbnails',
  'featFb1': 'Reels, videos & share links',
  'featFb2': 'HD & SD streams',
  'featFb3': 'Public post support',
  'featIg1': 'Reels & photo carousels',
  'featIg2': 'Stories & videos',
  'featIg3': 'Full-resolution images',
  'featTt1': 'No-watermark MP4',
  'featTt2': 'Photo post slides',
  'featTt3': 'HD cover download',
  'featX1': 'Tweets & media posts',
  'featX2': 'High-res videos & photos',
  'featX3': 'Public thread support',
  'featTh1': 'Video & photo posts',
  'featTh2': 'Carousel slides',
  'featTh3': 'Full-resolution export',
  'featPin1': 'HD video pins',
  'featPin2': 'Full-res image download',
  'featPin3': 'Preview-size export',

  'faqBadge': 'FAQ',
  'faqTitle': 'Frequently asked questions',
  'faq1q': 'Is this service really free?',
  'faq1a': 'Yes. Extraction runs entirely inside the app’s own server functions. There are no third-party paid APIs, no API keys, and no hidden costs.',
  'faq2q': 'Will the download open in a new tab?',
  'faq2a': 'No. Every download streams through our proxy route with a strict attachment header, which forces your browser to open the native “Save File” dialog immediately — on both desktop and mobile.',
  'faq3q': 'Which formats can I download?',
  'faq3a': 'YouTube: MP4 video (up to available progressive quality), MP3 audio, and HD/4K thumbnails. Facebook, Instagram, TikTok, X, and Threads: MP4 video and JPG images. Pinterest: MP4 video pins and full-resolution JPG images.',
  'faq4q': 'Why is 1080p not always available on YouTube?',
  'faq4a': 'YouTube serves 1080p+ as separate video and audio streams that require server-side merging. Since we run on stateless serverless functions with zero external APIs, we expose the best combined (progressive) formats plus MP3 audio.',
  'faq5q': 'What if the link is private or deleted?',
  'faq5a': 'The parser will return a clear, friendly error message. We only support public content that is legally shareable — please respect creators’ rights.',
  'faq6q': 'Is my data stored anywhere?',
  'faq6a': 'No. Links are processed in-memory and immediately discarded. We never log, store, or share the content you download.',

  'seoBadge': 'SEO guides',
  'seoTitle': 'Step-by-step download guides',
  'seoSubtitle': 'Expand any guide below for a quick walkthrough.',
  'seoGuideFbReels': 'How to Download Facebook Reels',
  'seoGuideFbReelsText': 'Copy the Reel link from the share menu, paste it here, and pick the HD or SD MP4 option. Mobile share links like facebook.com/share/r/... are resolved automatically.',
  'seoGuideTiktok': 'Save TikTok Videos Without Watermark',
  'seoGuideTiktokText': 'Paste a TikTok video link (including vt.tiktok.com short links). We locate the clean, watermark-free MP4 stream and offer it first.',
  'seoGuidePinterest': 'How to Save Pinterest Photos',
  'seoGuidePinterestText': 'Open a pin and copy its URL. You will get a full-resolution JPG from the originals CDN, not the small preview.',
  'seoGuideInstagram': 'Save Instagram Reels & Photos',
  'seoGuideInstagramText': 'Paste a Reel, Post, or Story link. Videos are offered as MP4 and photo carousels as full-resolution JPG files.',
  'seoGuideX': 'Download X / Twitter Videos',
  'seoGuideXText': 'Paste any x.com or twitter.com status link. We extract the highest-bitrate MP4 variant from the tweet’s media payload.',
  'seoGuideThreads': 'Download Threads Posts',
  'seoGuideThreadsText': 'Copy a threads.net post link. Video posts yield MP4 files and image posts yield full-resolution JPGs.',
  'seoGuideYoutube': 'Download YouTube Videos & MP3',
  'seoGuideYoutubeText': 'Paste any watch, shorts, or youtu.be link. Grab progressive MP4 up to the best available quality, MP3 audio, or the HD/4K thumbnail.',
  'seoLegalNote': 'Only download content you have the right to. These guides are for personal, educational use and respect creators’ rights.',

  'footerTagline': 'A fast, privacy-friendly, zero-cost downloader for YouTube, Facebook, Instagram, TikTok, X, Threads, and Pinterest content.',
  'footerSupported': 'Supported Platforms',
  'footerResources': 'Resources',
  'footerPrivacy': 'Privacy Policy',
  'footerTerms': 'Terms of Service',
  'footerContact': 'Contact',
  'footerNoData': 'No data stored, ever',
  'footerDesigned': 'Designed & Developed with',
  'footerBy': 'by Riyad',
  'footerRights': 'All Rights Reserved',
  'footerPlatformYt': 'Videos & MP3',
  'footerPlatformFb': 'Videos & Reels',
  'footerPlatformIg': 'Reels & Photos',
  'footerPlatformTt': 'No-watermark MP4',
  'footerPlatformX': 'Videos & Photos',
  'footerPlatformTh': 'Posts & Photos',
  'footerPlatformPin': 'Videos & Images',
} as const;

export type DictKey = keyof typeof en;

const bn: Record<DictKey, string> = {
  'howItWorks': 'কীভাবে কাজ করে',
  'platforms': 'প্ল্যাটফর্মসমূহ',
  'faq': 'প্রশ্নোত্তর',

  'heroBadge': 'ফ্রি · কোনো API কী নেই · কোনো ওয়াটারমার্ক নেই',
  'heroTitle1': 'ইউনিভার্সাল',
  'heroTitle2': 'সোশ্যাল মিডিয়া',
  'heroTitle3': 'ডাউনলোডার',
  'heroSubtitle': 'YouTube, Facebook, Instagram, TikTok, X / Twitter, Threads এবং Pinterest থেকে ভিডিও, MP3 অডিও ও হাই-রেজোলিউশন ছবি এক ট্যাপেই সরাসরি আপনার ফোন বা কম্পিউটারে সেভ করুন।',

  'inputPlaceholder': 'YouTube, Facebook, Instagram, TikTok, X, Threads বা Pinterest লিংক পেস্ট করুন…',
  'clearInput': 'ইনপুট মুছুন',
  'paste': 'পেস্ট',
  'pasteFromClipboard': 'ক্লিপবোর্ড থেকে পেস্ট করুন',
  'extract': 'এক্সট্র্যাক্ট',
  'extracting': 'এক্সট্র্যাক্ট হচ্ছে…',
  'detectedPlatform': 'শনাক্তকৃত প্ল্যাটফর্ম',
  'linkPasted': 'ক্লিপবোর্ড থেকে লিংক পেস্ট হয়েছে',
  'clipboardEmpty': 'ক্লিপবোর্ড খালি',
  'clipboardBlocked': 'এই ব্রাউজারে ক্লিপবোর্ড ব্যবহার ব্লক করা আছে',
  'clipboardManual': 'ক্লিপবোর্ড পড়া যায়নি। অনুগ্রহ করে ম্যানুয়ালি পেস্ট করুন।',
  'pasteLinkFirst': 'আগে একটি লিংক পেস্ট করুন',
  'linkNotSupported': 'এই লিংকটি সাপোর্ট করা হয় না',
  'mediaReady': 'মিডিয়া প্রস্তুত — নিচ থেকে ফরম্যাট বেছে নিন',
  'genericError': 'কিছু ভুল হয়েছে। আবার চেষ্টা করুন।',
  'extractionFailed': 'এক্সট্র্যাক্ট ব্যর্থ হয়েছে',
  'networkError': 'নেটওয়ার্ক সমস্যা। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
  'serverUnreachable': 'সার্ভারে পৌঁছানো যায়নি',
  'processing': 'আপনার লিংক প্রসেস হচ্ছে…',

  'customFilename': 'কাস্টম ফাইলের নাম (ঐচ্ছিক)',
  'downloadOptions': 'ডাউনলোড অপশন',
  'save': 'সেভ',
  'starting': 'শুরু হচ্ছে…',
  'downloading': '{label} ডাউনলোড হচ্ছে',
  'downloadDisclaimer': 'আপনার ফাইল সরাসরি সোর্স সার্ভার থেকে স্ট্রিম হয়। শুধুমাত্র সেই কন্টেন্ট ডাউনলোড করুন যার অধিকার আপনার আছে।',
  'options': 'অপশন',
  'option': 'অপশন',
  'tierUltra': 'আল্ট্রা HD / 1080p',
  'tierHd': 'HD / 720p',
  'tierSd': 'মিডিয়াম / SD',
  'tierAudio': 'MP3 অডিও',
  'tierImage': 'HD থাম্বনেইল',
  'thumbnailButton': 'HD/4K থাম্বনেইল ডাউনলোড করুন',
  'thumbnailCaption': 'JPG · ফুল রেজোলিউশন',

  'howItWorksBadge': 'কীভাবে কাজ করে',
  'howItWorksTitle': 'তিনটি ধাপ, কোনো ঝামেলা নেই',
  'step1Title': 'লিংক পেস্ট করুন',
  'step1Desc': 'যেকোনো পাবলিক ভিডিও বা পিনের লিংক কপি করুন। আমাদের স্মার্ট ইনপুট সাথে সাথে প্ল্যাটফর্ম শনাক্ত করে।',
  'step2Title': 'নেটিভ এক্সট্র্যাকশন',
  'step2Desc': 'আমাদের সার্ভার পেজের মেটাডেটা বিশ্লেষণ করে আসল, ফুল-কোয়ালিটি মিডিয়া স্ট্রিম খুঁজে বের করে।',
  'step3Title': 'যেকোনো জায়গায় সেভ করুন',
  'step3Desc': 'একটি ফরম্যাট বেছে নিন এবং ফাইলটি সরাসরি আপনার ফোন বা কম্পিউটারে নেটিভ ডাউনলোড হিসেবে সেভ হোক।',
  'howItWorksNote': '১০০% নেটিভ সার্ভার লজিক — কোনো পেইড API নেই, কোনো সাইন-আপ নেই, কোনো গোপন সীমা নেই।',

  'platformsBadge': 'সাপোর্টেড প্ল্যাটফর্ম',
  'platformsTitle': 'সাতটি প্ল্যাটফর্ম। একটি ডাউনলোডার।',
  'platformsSubtitle': 'প্রতিটি প্ল্যাটফর্মের জন্য নিজস্ব নেটিভ পার্সার — কোনো থার্ড-পার্টি সার্ভিস নেই।',

  'featYt1': 'HD ভিডিও ডাউনলোড',
  'featYt2': 'MP3 অডিও এক্সট্রাকশন',
  'featYt3': 'Shorts, Live ও 4K থাম্বনেইল',
  'featFb1': 'Reels, ভিডিও ও শেয়ার লিংক',
  'featFb2': 'HD ও SD স্ট্রিম',
  'featFb3': 'পাবলিক পোস্ট সাপোর্ট',
  'featIg1': 'Reels ও ফটো ক্যারোসেল',
  'featIg2': 'Stories ও ভিডিও',
  'featIg3': 'ফুল-রেজোলিউশন ছবি',
  'featTt1': 'ওয়াটারমার্ক-মুক্ত MP4',
  'featTt2': 'ফটো পোস্ট স্লাইড',
  'featTt3': 'HD কভার ডাউনলোড',
  'featX1': 'টুইট ও মিডিয়া পোস্ট',
  'featX2': 'হাই-রেজ ভিডিও ও ছবি',
  'featX3': 'পাবলিক থ্রেড সাপোর্ট',
  'featTh1': 'ভিডিও ও ফটো পোস্ট',
  'featTh2': 'ক্যারোসেল স্লাইড',
  'featTh3': 'ফুল-রেজোলিউশন এক্সপোর্ট',
  'featPin1': 'HD ভিডিও পিন',
  'featPin2': 'ফুল-রেজ ইমেজ ডাউনলোড',
  'featPin3': 'প্রিভিউ সাইজ এক্সপোর্ট',

  'faqBadge': 'প্রশ্নোত্তর',
  'faqTitle': 'সাধারণ জিজ্ঞাসা',
  'faq1q': 'এই সার্ভিসটি কি সত্যিই ফ্রি?',
  'faq1a': 'হ্যাঁ। এক্সট্রাকশন সম্পূর্ণরূপে অ্যাপের নিজস্ব সার্ভার ফাংশনের ভেতরে চলে। কোনো থার্ড-পার্টি পেইড API, কোনো API কী এবং কোনো গোপন খরচ নেই।',
  'faq2q': 'ডাউনলোড কি নতুন ট্যাবে খুলবে?',
  'faq2a': 'না। প্রতিটি ডাউনলোড আমাদের প্রক্সি রুট দিয়ে strict attachment হেডারসহ যায়, যা ব্রাউজারকে সাথে সাথে নেটিভ “Save File” ডায়ালগ খুলতে বাধ্য করে — ডেস্কটপ ও মোবাইল উভয় ক্ষেত্রেই।',
  'faq3q': 'কোন কোন ফরম্যাট ডাউনলোড করতে পারব?',
  'faq3a': 'YouTube: MP4 ভিডিও (উপলব্ধ প্রগ্রেসিভ কোয়ালিটি পর্যন্ত), MP3 অডিও এবং HD/4K থাম্বনেইল। Facebook, Instagram, TikTok, X ও Threads: MP4 ভিডিও ও JPG ছবি। Pinterest: MP4 ভিডিও পিন ও ফুল-রেজোলিউশন JPG ছবি।',
  'faq4q': 'YouTube-এ 1080p কেন সবসময় থাকে না?',
  'faq4a': 'YouTube 1080p+ আলাদা ভিডিও ও অডিও স্ট্রিম হিসেবে দেয় যার জন্য সার্ভার-সাইড মার্জিং দরকার। যেহেতু আমরা কোনো বাহ্যিক API ছাড়া স্টেটলেস সার্ভারলেস ফাংশনে চালাই, তাই আমরা সেরা কম্বাইন্ড (প্রগ্রেসিভ) ফরম্যাট ও MP3 অডিও দিই।',
  'faq5q': 'লিংকটি প্রাইভেট বা মুছে ফেলা হলে কী হবে?',
  'faq5a': 'পার্সার একটি পরিষ্কার, বন্ধুত্বপূর্ণ এরর মেসেজ দেখাবে। আমরা শুধুমাত্র পাবলিক, আইনত শেয়ারযোগ্য কন্টেন্ট সাপোর্ট করি — অনুগ্রহ করে নির্মাতাদের অধিকার সম্মান করুন।',
  'faq6q': 'আমার ডেটা কি কোথাও জমা হয়?',
  'faq6a': 'না। লিংকগুলো মেমোরিতে প্রসেস হয়ে সাথে সাথে মুছে যায়। আপনি যা ডাউনলোড করেন তা আমরা কখনও লগ, স্টোর বা শেয়ার করি না।',

  'seoBadge': 'SEO গাইড',
  'seoTitle': 'ধাপে ধাপে ডাউনলোড গাইড',
  'seoSubtitle': 'নিচের যেকোনো গাইড খুলুন।',
  'seoGuideFbReels': 'Facebook Reels ডাউনলোড করার নিয়ম',
  'seoGuideFbReelsText': 'শেয়ার মেনু থেকে Reel-এর লিংক কপি করে এখানে পেস্ট করুন এবং HD বা SD MP4 অপশন বেছে নিন। facebook.com/share/r/... এর মতো মোবাইল শেয়ার লিংক স্বয়ংক্রিয়ভাবে রেজোল্ভ হয়।',
  'seoGuideTiktok': 'ওয়াটারমার্ক ছাড়া TikTok ভিডিও সেভ করুন',
  'seoGuideTiktokText': 'TikTok ভিডিও লিংক পেস্ট করুন (vt.tiktok.com শর্ট লিংকসহ)। আমরা ওয়াটারমার্ক-মুক্ত MP4 স্ট্রিম খুঁজে বের করে সবার আগে দিই।',
  'seoGuidePinterest': 'Pinterest ফটো সেভ করার নিয়ম',
  'seoGuidePinterestText': 'যেকোনো পিন খুলে এর URL কপি করুন। আপনি ছোট প্রিভিউ নয়, অরিজিনাল CDN থেকে ফুল-রেজোলিউশন JPG পাবেন।',
  'seoGuideInstagram': 'Instagram Reels ও ফটো সেভ করুন',
  'seoGuideInstagramText': 'Reel, পোস্ট বা স্টোরি লিংক পেস্ট করুন। ভিডিও MP4 হিসেবে এবং ফটো ক্যারোসেল ফুল-রেজোলিউশন JPG ফাইল হিসেবে আসবে।',
  'seoGuideX': 'X / Twitter ভিডিও ডাউনলোড করুন',
  'seoGuideXText': 'যেকোনো x.com বা twitter.com স্ট্যাটাস লিংক পেস্ট করুন। আমরা টুইটের মিডিয়া পেলোড থেকে সবচেয়ে বেশি বিটরেটের MP4 ভেরিয়েন্ট বের করি।',
  'seoGuideThreads': 'Threads পোস্ট ডাউনলোড করুন',
  'seoGuideThreadsText': 'threads.net পোস্ট লিংক কপি করুন। ভিডিও পোস্ট MP4 ফাইল আর ইমেজ পোস্ট ফুল-রেজোলিউশন JPG দেয়।',
  'seoGuideYoutube': 'YouTube ভিডিও ও MP3 ডাউনলোড করুন',
  'seoGuideYoutubeText': 'যেকোনো watch, shorts বা youtu.be লিংক পেস্ট করুন। সেরা উপলব্ধ কোয়ালিটিতে প্রগ্রেসিভ MP4, MP3 অডিও বা HD/4K থাম্বনেইল নিন।',
  'seoLegalNote': 'শুধুমাত্র সেই কন্টেন্ট ডাউনলোড করুন যার অধিকার আপনার আছে। এই গাইডগুলো ব্যক্তিগত ও শিক্ষামূলক ব্যবহারের জন্য এবং নির্মাতাদের অধিকার সম্মান করে।',

  'footerTagline': 'YouTube, Facebook, Instagram, TikTok, X, Threads ও Pinterest কন্টেন্টের জন্য দ্রুত, প্রাইভেসি-বান্ধব, শূন্য-খরচের ডাউনলোডার।',
  'footerSupported': 'সাপোর্টেড প্ল্যাটফর্ম',
  'footerResources': 'রিসোর্স',
  'footerPrivacy': 'প্রাইভেসি পলিসি',
  'footerTerms': 'সার্ভিসের শর্তাবলি',
  'footerContact': 'যোগাযোগ',
  'footerNoData': 'কখনও কোনো ডেটা জমা হয় না',
  'footerDesigned': 'ডিজাইন ও ডেভেলপ',
  'footerBy': 'Riyad',
  'footerRights': 'সর্বস্বত্ব সংরক্ষিত',
  'footerPlatformYt': 'ভিডিও ও MP3',
  'footerPlatformFb': 'ভিডিও ও রিলস',
  'footerPlatformIg': 'রিলস ও ছবি',
  'footerPlatformTt': 'ওয়াটারমার্ক-মুক্ত MP4',
  'footerPlatformX': 'ভিডিও ও ছবি',
  'footerPlatformTh': 'পোস্ট ও ছবি',
  'footerPlatformPin': 'ভিডিও ও ছবি',
};

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: DictKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'unidownloader-lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'bn') setLangState(stored);
    } catch {
      // ignore storage access errors
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage access errors
    }
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);
  const toggleLang = useCallback(() => setLangState((prev) => (prev === 'en' ? 'bn' : 'en')), []);

  const t = useCallback(
    (key: DictKey, params?: Record<string, string | number>) => {
      let text = lang === 'bn' ? bn[key] : en[key];
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.replaceAll(`{${name}}`, String(value));
        }
      }
      return text;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
