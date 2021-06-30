/* eslint-disable */
import fs from 'fs';
import path from 'path';
import { customElementsManifestToMarkdown } from '@custom-elements-manifest/to-markdown';

const has = arr => Array.isArray(arr) && arr.length > 0;

function sortBy (propertyName, desc = false) {
  return (a, b) => {
    return (desc === false)
      ? a[propertyName].localeCompare(b[propertyName])
      : b[propertyName].localeCompare(a[propertyName]);
  };
}

function sortAlphabeticallyPlugin() {
  return {
    name: 'sort-alphabetically',
    packageLinkPhase ({ customElementsManifest }) {
      for (const mod of customElementsManifest?.modules) {
        for (const declaration of mod?.declarations) {
          ['members', 'attributes', 'events', 'cssProperties', 'slots', 'cssParts'].forEach(kind => {
            declaration?.[kind]?.sort(sortBy('name'));
          });
        }
      }
    },
  };
}

function outputDocsPlugin() {
  return {
    name: 'generate-md-docs',
    packageLinkPhase({ customElementsManifest }) {
      customElementsManifest?.modules?.forEach(mod => {
        const modulePath = path.dirname(mod.path);
        const customElements = mod?.declarations?.filter(({customElement, kind}) => customElement || kind === 'mixin');
        customElements?.forEach(klass => {

          const doc = { modules: [{path: mod.path,declarations: [klass]}]};

          const docsPath = path.join(modulePath, 'docs');
          if(!fs.existsSync(docsPath)) {
            fs.mkdirSync(docsPath);
          }
          fs.writeFileSync(path.join(docsPath, `${klass.name}.md`), customElementsManifestToMarkdown(doc));
        });
      });  
    }
  }
}

function denyListPlugin() {
  return {
    name: 'deny-list',
    moduleLinkPhase({moduleDoc}) {
      moduleDoc?.declarations?.forEach(declaration => {
        if(declaration.kind === 'class') {
          if(has(declaration.members)) {
            declaration.members = declaration?.members?.filter(member => !(member.name === 'scopedElements' || member.name === 'localizeNamespaces'));
          }
        }
      });
    },
  }
}

function privacyPlugin () {
  return {
    name: 'privacy',
    packageLinkPhase ({ customElementsManifest }) {
      for (const mod of customElementsManifest?.modules) {
        for (const declaration of mod?.declarations) {
          if (has(declaration.members)) {
            declaration.members = declaration.members.map((member) => {
              const isPrivate = member.name.startsWith('_');
              const isProtected = member.name.startsWith('__');

              if(isProtected) {
                return {...member, privacy: 'protected'};
              }

              if(isPrivate) {
                return {...member, privacy: 'private'};
              }

              
              if(!member?.privacy) {
                return {...member, privacy: 'public'}
              }

              return member;
            });

            const pub = declaration.members.filter(member => member.privacy === 'public');
            const priv = declaration.members.filter(member => member.privacy === 'private');
            const prot = declaration.members.filter(member => member.privacy === 'protected');

            declaration.members = [
              ...pub,
              ...priv,
              ...prot
            ]
          }
        }
      }
    },
  };
}

export const DOCS_PRESET = ({
  outputDocs = true,
} = {}) => [
  denyListPlugin(),
  sortAlphabeticallyPlugin(),
  privacyPlugin(),
  outputDocs && outputDocsPlugin(),
];