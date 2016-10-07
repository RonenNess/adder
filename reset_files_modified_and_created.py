import os
import fileter

class RecreateFile(fileter.FilesIterator):
    def process_file(self, path, dryrun):

        if dryrun:
            return path

        print path

        with open(path, "rb") as infile:
            data = infile.read()

        with open(path, "wb") as outfile:
            outfile.write(data)

it = RecreateFile()
it.add_folder(".")
it.add_filter_by_pattern("*/*.idea*/*", it.FilterType.Exclude)
it.add_filter_by_pattern("*/*.git*/*", it.FilterType.Exclude)
it.process_all()
