import { useEffect, useState } from 'react';
import { Dialog, DialogTrigger, DialogContent, } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import SafeLink from '@/components/ui/safe-link';

type Template = {
  template_name: string;
  industry: string;
  layout: string;
  color_scheme: string;
  data?: any;
  is_site?: boolean;
};

type Props = {
  onSelect: (templateName: string) => void;
};

export default function TemplateBrowser({ onSelect }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);

  useEffect(() => {
    fetch('/api/templates/full') // load full data for preview
      .then((res) => res.json())
      .then((data) => setTemplates(data))
      .catch(console.error);
  }, []);

  return (
    <>
      <ScrollArea className="h-[500px] w-full p-4">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.template_name} className="p-3">
              <CardContent className="space-y-2">
                <h3 className="text-lg font-bold">{t.template_name}</h3>
                <p className="text-sm text-muted-foreground">
                  Industry: {t.industry}
                  <br />
                  Layout: {t.layout}
                  <br />
                  Colors: {t.color_scheme}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => onSelect(t.template_name)}>
                    Use
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="secondary" onClick={() => setSelected(t)}>
                        Preview
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl">
                      <h4 className="text-xl font-semibold">{t.template_name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Layout: {t.layout}, Colors: {t.color_scheme}
                      </p>
                      <ul className="text-sm space-y-1">
                        {t.data?.pages.map((page: any) => (
                          <li key={page.slug}>
                            <strong>{page.slug}</strong>: {page.title}
                          </li>
                        ))}
                      </ul>
                      <hr className="my-2" />
                      <p className="italic text-xs">
                        Hero: {t.data?.pages[0]?.content_blocks?.[0]?.headline}
                      </p>
                      <div className="flex justify-end gap-2 mt-4">
                        <SafeLink href={`/admin/templates/new?copy=${t.template_name}`}>
                          <Button variant="secondary" size="sm">
                            Duplicate This
                          </Button>
                        </SafeLink>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </>
  );
}
