// types/params.ts

export type SlugParams = {
  params: {
    slug: string;
  };
};

export type IdParams = {
  params: {
    id: string;
  };
};

export type HandleParams = {
  params: {
    handle: string;
  };
};

export type TokenParams = {
  params: {
    token: string;
  };
};

export type UserIdParams = {
  params: {
    userId: string;
  };
};

export type TemplateNameParams = {
  params: {
    templateName: string;
  };
};

// Generic fallback for any dynamic param
export type RouteParam<T extends string> = {
  params: {
    [key in T]: string;
  };
};
