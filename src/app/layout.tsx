import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'نظام أمان للتقسيط | إدارة التمويل والأقساط والأصول',
  description:
    'تطبيق ويب متكامل لإدارة رؤوس أموال المستثمرين بصناديق ومحافظ مستقلة، تحويلها إلى أصول ومواد، وتوفير التمويل بالأقساط للمواطنين في العراق (صلاح الدين - سامراء) مع احتساب وتوزيع الأرباح تلقائياً.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar-u-nu-latn" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function enforceEnglish(root) {
                  try {
                    var elms = (root || document).querySelectorAll('input[type="date"], input[type="number"], input[type="tel"]');
                    for (var i = 0; i < elms.length; i++) {
                      if (elms[i].getAttribute('lang') !== 'en') {
                        elms[i].setAttribute('lang', 'en');
                      }
                    }
                  } catch (e) {}
                }
                if (typeof window !== 'undefined') {
                  if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', function() { enforceEnglish(); });
                  } else {
                    enforceEnglish();
                  }
                  var obs = new MutationObserver(function(muts) {
                    for (var j = 0; j < muts.length; j++) {
                      if (muts[j].addedNodes.length) {
                        enforceEnglish();
                        break;
                      }
                    }
                  });
                  obs.observe(document.documentElement, { childList: true, subtree: true });
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans bg-slate-950 text-slate-100 antialiased selection:bg-[#1783C1] selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
