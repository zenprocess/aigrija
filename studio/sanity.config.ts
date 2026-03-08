import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './schemas'

export default defineConfig({
  name: 'ai-grija',
  title: 'ai-grija.ro Content Studio',
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'REPLACE_ME',
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  basePath: '/studio',
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Content')
          .items([
            S.listItem()
              .title('Ghiduri')
              .child(
                S.list()
                  .title('Ghiduri')
                  .items([
                    S.listItem()
                      .title('Blog Posts (Ghid)')
                      .schemaType('blogPost')
                      .child(
                        S.documentList()
                          .title('Blog Posts (Ghid)')
                          .filter('_type == "blogPost" && category == "ghid"')
                      ),
                    S.listItem()
                      .title('Bank Guides')
                      .schemaType('bankGuide')
                      .child(
                        S.documentList()
                          .title('Bank Guides')
                          .filter('_type == "bankGuide"')
                      ),
                  ])
              ),
            S.listItem()
              .title('Educatie')
              .child(
                S.list()
                  .title('Educatie')
                  .items([
                    S.listItem()
                      .title('Blog Posts (Educatie)')
                      .schemaType('blogPost')
                      .child(
                        S.documentList()
                          .title('Blog Posts (Educatie)')
                          .filter('_type == "blogPost" && category == "educatie"')
                      ),
                    S.listItem()
                      .title('School Modules')
                      .schemaType('schoolModule')
                      .child(
                        S.documentList()
                          .title('School Modules')
                          .filter('_type == "schoolModule"')
                      ),
                  ])
              ),
            S.listItem()
              .title('Amenintari')
              .schemaType('threatReport')
              .child(
                S.documentList()
                  .title('Threat Reports')
                  .filter('_type == "threatReport"')
              ),
            S.listItem()
              .title('Rapoarte')
              .schemaType('weeklyDigest')
              .child(
                S.documentList()
                  .title('Weekly Digests')
                  .filter('_type == "weeklyDigest"')
              ),
            S.listItem()
              .title('Povesti')
              .schemaType('communityStory')
              .child(
                S.documentList()
                  .title('Community Stories')
                  .filter('_type == "communityStory"')
              ),
            S.listItem()
              .title('Presa')
              .schemaType('pressRelease')
              .child(
                S.documentList()
                  .title('Press Releases')
                  .filter('_type == "pressRelease"')
              ),
            S.divider(),
            S.listItem()
              .title('All Blog Posts')
              .schemaType('blogPost')
              .child(S.documentTypeList('blogPost').title('All Blog Posts')),
            S.divider(),
            S.listItem()
              .title('Categories')
              .schemaType('category')
              .child(S.documentTypeList('category').title('Categories')),
            S.listItem()
              .title('Authors')
              .schemaType('author')
              .child(S.documentTypeList('author').title('Authors')),
          ]),
    }),
    visionTool(),
  ],
  schema: { types: schemaTypes },
})
